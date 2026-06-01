function loadReadOnlyRpcModule() {
  jest.resetModules();

  const mockFindChain = jest.fn();
  const mockRpcCacheGet = jest.fn();
  const mockRpcCacheSet = jest.fn();
  const mockHasCustomRPC = jest.fn();
  const mockRequestCustomRPC = jest.fn();
  const mockDefaultEthRPC = jest.fn();
  const mockGetClient = jest.fn();
  const mockClientRequest = jest.fn();

  jest.doMock('@/constant', () => ({
    INTERNAL_REQUEST_SESSION: {
      origin: 'internal://rabby',
    },
  }));
  jest.doMock('@/constant/chains', () => ({
    CHAINS_ENUM: {
      ETH: 'eth',
    },
  }));
  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
  }));
  jest.doMock('@/core/services/customRPCService', () => ({
    customRPCService: {
      defaultEthRPC: (...args: unknown[]) => mockDefaultEthRPC(...args),
      hasCustomRPC: (...args: unknown[]) => mockHasCustomRPC(...args),
      requestCustomRPC: (...args: unknown[]) => mockRequestCustomRPC(...args),
    },
  }));
  jest.doMock('@/core/services/customTestnetService', () => ({
    customTestnetService: {
      getClient: (...args: unknown[]) => mockGetClient(...args),
    },
  }));
  jest.doMock('@/core/services/rpcCache', () => ({
    __esModule: true,
    default: {
      get: (...args: unknown[]) => mockRpcCacheGet(...args),
      set: (...args: unknown[]) => mockRpcCacheSet(...args),
    },
  }));

  mockGetClient.mockReturnValue({
    request: mockClientRequest,
  });

  const { requestReadOnlyETHRpc } =
    require('./readOnlyRpc') as typeof import('./readOnlyRpc');

  return {
    requestReadOnlyETHRpc,
    mocks: {
      mockClientRequest,
      mockDefaultEthRPC,
      mockFindChain,
      mockGetClient,
      mockHasCustomRPC,
      mockRequestCustomRPC,
      mockRpcCacheGet,
      mockRpcCacheSet,
    },
  };
}

describe('core/apis/readOnlyRpc', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('returns an account-scoped cached RPC result without touching services', async () => {
    const { requestReadOnlyETHRpc, mocks } = loadReadOnlyRpcModule();
    mocks.mockRpcCacheGet.mockReturnValue('cached-result');

    await expect(
      requestReadOnlyETHRpc(
        {
          method: 'eth_call',
          params: [
            {
              to: '0xcontract',
            },
            'latest',
          ],
        },
        'eth',
        {
          address: '0xABC',
        } as never,
      ),
    ).resolves.toBe('cached-result');

    expect(mocks.mockRpcCacheGet).toHaveBeenCalledWith('0xabc', {
      chainId: 'eth',
      method: 'eth_call',
      params: [
        {
          to: '0xcontract',
        },
        'latest',
      ],
    });
    expect(mocks.mockFindChain).not.toHaveBeenCalled();
    expect(mocks.mockRequestCustomRPC).not.toHaveBeenCalled();
    expect(mocks.mockDefaultEthRPC).not.toHaveBeenCalled();
    expect(mocks.mockClientRequest).not.toHaveBeenCalled();
  });

  it('routes mainnet requests through a configured custom RPC and caches the pending promise and final result', async () => {
    const { requestReadOnlyETHRpc, mocks } = loadReadOnlyRpcModule();
    mocks.mockRpcCacheGet.mockReturnValue(undefined);
    mocks.mockFindChain.mockReturnValue({
      enum: 'eth',
      id: 1,
      isTestnet: false,
      serverId: 'eth',
    });
    mocks.mockHasCustomRPC.mockReturnValue(true);
    mocks.mockRequestCustomRPC.mockResolvedValue('0x123');

    await expect(
      requestReadOnlyETHRpc(
        {
          method: 'eth_getBalance',
          params: ['0xabc', 'latest'],
        },
        'eth',
        {
          address: '0xabc',
        } as never,
      ),
    ).resolves.toBe('0x123');

    expect(mocks.mockRequestCustomRPC).toHaveBeenCalledWith(
      'eth',
      'eth_getBalance',
      ['0xabc', 'latest'],
    );
    expect(mocks.mockRpcCacheSet).toHaveBeenNthCalledWith(1, '0xabc', {
      chainId: 'eth',
      method: 'eth_getBalance',
      params: ['0xabc', 'latest'],
      result: expect.any(Promise),
    });
    expect(mocks.mockRpcCacheSet).toHaveBeenNthCalledWith(2, '0xabc', {
      chainId: 'eth',
      method: 'eth_getBalance',
      params: ['0xabc', 'latest'],
      result: '0x123',
    });
  });

  it('falls back to the default ETH RPC when no chain-specific custom RPC exists', async () => {
    const { requestReadOnlyETHRpc, mocks } = loadReadOnlyRpcModule();
    mocks.mockRpcCacheGet.mockReturnValue(undefined);
    mocks.mockFindChain.mockImplementation(({ enum: chainEnum }) =>
      chainEnum === 'eth'
        ? {
            enum: 'eth',
            id: 1,
            isTestnet: false,
            serverId: 'eth',
          }
        : null,
    );
    mocks.mockHasCustomRPC.mockReturnValue(false);
    mocks.mockDefaultEthRPC.mockResolvedValue('0x456');

    await expect(
      requestReadOnlyETHRpc(
        {
          method: 'eth_blockNumber',
          params: [],
        },
        'unknown',
        null,
      ),
    ).resolves.toBe('0x456');

    expect(mocks.mockDefaultEthRPC).toHaveBeenCalledWith({
      chainServerId: 'unknown',
      method: 'eth_blockNumber',
      origin: 'internal://rabby',
      params: [],
    });
  });

  it('routes testnet requests through the custom testnet client', async () => {
    const { requestReadOnlyETHRpc, mocks } = loadReadOnlyRpcModule();
    mocks.mockRpcCacheGet.mockReturnValue(undefined);
    mocks.mockFindChain.mockReturnValue({
      enum: 'custom9001',
      id: 9001,
      isTestnet: true,
      serverId: 'custom9001',
    });
    mocks.mockClientRequest.mockResolvedValue('0xtestnet');

    await expect(
      requestReadOnlyETHRpc(
        {
          method: 'eth_getTransactionCount',
          params: ['0xabc', 'latest'],
        },
        'custom9001',
        undefined,
      ),
    ).resolves.toBe('0xtestnet');

    expect(mocks.mockGetClient).toHaveBeenCalledWith(9001);
    expect(mocks.mockClientRequest).toHaveBeenCalledWith({
      method: 'eth_getTransactionCount',
      params: ['0xabc', 'latest'],
    });
  });
});
