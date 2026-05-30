const mockRpcCacheGet = jest.fn();
const mockRpcCacheSet = jest.fn();
const mockFindChain = jest.fn();
const mockHasCustomRPC = jest.fn();
const mockRequestCustomRPC = jest.fn();
const mockDefaultEthRPC = jest.fn();
const mockGetTestnetClient = jest.fn();
const mockTestnetRequest = jest.fn();

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_SESSION: {
    origin: 'rabby-internal',
  },
}));

jest.mock('@/constant/chains', () => ({
  CHAINS_ENUM: {
    ETH: 'ETH',
  },
}));

jest.mock('@/core/services/customRPCService', () => ({
  customRPCService: {
    hasCustomRPC: (...args: unknown[]) => mockHasCustomRPC(...args),
    requestCustomRPC: (...args: unknown[]) => mockRequestCustomRPC(...args),
    defaultEthRPC: (...args: unknown[]) => mockDefaultEthRPC(...args),
  },
}));

jest.mock('@/core/services/customTestnetService', () => ({
  customTestnetService: {
    getClient: (...args: unknown[]) => mockGetTestnetClient(...args),
  },
}));

jest.mock('@/core/services/rpcCache', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockRpcCacheGet(...args),
    set: (...args: unknown[]) => mockRpcCacheSet(...args),
  },
}));

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
}));

import { requestReadOnlyETHRpc } from './readOnlyRpc';

const mainnetChain = {
  id: 1,
  enum: 'ETH',
  serverId: 'eth',
  isTestnet: false,
};
const testnetChain = {
  id: 9001,
  enum: 'TESTNET',
  serverId: 'testnet',
  isTestnet: true,
};

describe('requestReadOnlyETHRpc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpcCacheGet.mockReturnValue(undefined);
    mockFindChain.mockReturnValue(mainnetChain);
    mockHasCustomRPC.mockReturnValue(false);
    mockRequestCustomRPC.mockResolvedValue('custom-result');
    mockDefaultEthRPC.mockResolvedValue('default-result');
    mockTestnetRequest.mockResolvedValue('testnet-result');
    mockGetTestnetClient.mockReturnValue({
      request: (...args: unknown[]) => mockTestnetRequest(...args),
    });
  });

  it('returns cached read-only RPC results without hitting any transport', async () => {
    mockRpcCacheGet.mockReturnValue('cached-result');

    await expect(
      requestReadOnlyETHRpc(
        {
          method: 'eth_blockNumber',
          params: [],
        },
        'eth',
        { address: '0xABC' } as never,
      ),
    ).resolves.toBe('cached-result');

    expect(mockRpcCacheGet).toHaveBeenCalledWith('0xabc', {
      method: 'eth_blockNumber',
      params: [],
      chainId: 'eth',
    });
    expect(mockRequestCustomRPC).not.toHaveBeenCalled();
    expect(mockDefaultEthRPC).not.toHaveBeenCalled();
    expect(mockRpcCacheSet).not.toHaveBeenCalled();
  });

  it('routes mainnet requests through custom RPC when enabled and caches the promise and result', async () => {
    mockHasCustomRPC.mockReturnValue(true);

    await expect(
      requestReadOnlyETHRpc(
        {
          method: 'eth_getBalance',
          params: ['0xabc', 'latest'],
        },
        'eth',
        { address: '0xABC' } as never,
      ),
    ).resolves.toBe('custom-result');

    expect(mockRequestCustomRPC).toHaveBeenCalledWith('ETH', 'eth_getBalance', [
      '0xabc',
      'latest',
    ]);
    expect(mockRpcCacheSet).toHaveBeenNthCalledWith(1, '0xabc', {
      method: 'eth_getBalance',
      params: ['0xabc', 'latest'],
      result: expect.any(Promise),
      chainId: 'eth',
    });
    expect(mockRpcCacheSet).toHaveBeenNthCalledWith(2, '0xabc', {
      method: 'eth_getBalance',
      params: ['0xabc', 'latest'],
      result: 'custom-result',
      chainId: 'eth',
    });
  });

  it('routes mainnet requests through default RPC when no custom RPC is enabled', async () => {
    await expect(
      requestReadOnlyETHRpc(
        {
          method: 'eth_chainId',
          params: [],
        },
        'eth',
        null,
      ),
    ).resolves.toBe('default-result');

    expect(mockDefaultEthRPC).toHaveBeenCalledWith({
      chainServerId: 'eth',
      origin: 'rabby-internal',
      method: 'eth_chainId',
      params: [],
    });
  });

  it('falls back unknown chains to ETH default routing', async () => {
    mockFindChain.mockImplementation(({ serverId, enum: chainEnum }) => {
      if (serverId === 'unknown') {
        return undefined;
      }
      if (chainEnum === 'ETH') {
        return mainnetChain;
      }
      return undefined;
    });

    await requestReadOnlyETHRpc(
      {
        method: 'eth_chainId',
        params: [],
      },
      'unknown',
    );

    expect(mockDefaultEthRPC).toHaveBeenCalledWith(
      expect.objectContaining({
        chainServerId: 'unknown',
      }),
    );
  });

  it('routes testnet requests through the custom testnet client', async () => {
    mockFindChain.mockReturnValue(testnetChain);

    await expect(
      requestReadOnlyETHRpc(
        {
          method: 'eth_call',
          params: [{ to: '0xabc' }, 'latest'],
        },
        'testnet',
        { address: '0xABC' } as never,
      ),
    ).resolves.toBe('testnet-result');

    expect(mockGetTestnetClient).toHaveBeenCalledWith(9001);
    expect(mockTestnetRequest).toHaveBeenCalledWith({
      method: 'eth_call',
      params: [{ to: '0xabc' }, 'latest'],
    });
    expect(mockDefaultEthRPC).not.toHaveBeenCalled();
  });
});
