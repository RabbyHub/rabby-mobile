const mockMatomoRequestEvent = jest.fn();
const mockCustomTestnetAdd = jest.fn();
const mockGetTransactionCount = jest.fn();
const mockGetNonceByChain = jest.fn();
const mockFindChain = jest.fn();
const mockGetChainListByIds = jest.fn();

jest.mock('@/utils/analytics', () => ({
  matomoRequestEvent: (...args: unknown[]) => mockMatomoRequestEvent(...args),
}));

jest.mock('../services/shared', () => ({
  customTestnetService: {
    add: (...args: unknown[]) => mockCustomTestnetAdd(...args),
    update: jest.fn(),
    remove: jest.fn(),
    getList: jest.fn(),
    getTransactionCount: (...args: unknown[]) =>
      mockGetTransactionCount(...args),
    estimateGas: jest.fn(),
    getGasPrice: jest.fn(),
    getGasMarket: jest.fn(),
    getToken: jest.fn(),
    removeToken: jest.fn(),
    addToken: jest.fn(),
    getTokenList: jest.fn(),
    hasToken: jest.fn(),
    getTx: jest.fn(),
    getTransactionReceipt: jest.fn(),
  },
  transactionHistoryService: {
    getNonceByChain: (...args: unknown[]) => mockGetNonceByChain(...args),
    store: {
      transactions: {},
    },
  },
}));

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
}));

jest.mock('../request', () => ({
  openapi: {
    getChainListByIds: (...args: unknown[]) => mockGetChainListByIds(...args),
  },
}));

import { apiCustomTestnet } from './customTestnet';
import { transactionHistoryService } from '../services/shared';

describe('apiCustomTestnet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCustomTestnetAdd.mockResolvedValue({ id: 9001 });
    mockGetTransactionCount.mockResolvedValue(7);
    mockGetNonceByChain.mockResolvedValue(0);
    mockFindChain.mockReturnValue(undefined);
    mockGetChainListByIds.mockResolvedValue([]);
    transactionHistoryService.store.transactions = {};
  });

  it('tracks successful custom testnet additions with the requested source', async () => {
    const chain = {
      id: 9001,
      name: 'Local devnet',
      rpcUrl: 'https://rpc.example',
    };

    await expect(
      apiCustomTestnet.addCustomTestnet(chain as never, {
        ga: { source: 'dapp' },
      }),
    ).resolves.toEqual({ id: 9001 });

    expect(mockCustomTestnetAdd).toHaveBeenCalledWith(chain);
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Custom Network',
      action: 'Success Add Network',
      label: 'dapp_9001',
    });
  });

  it('does not track failed custom testnet additions', async () => {
    mockCustomTestnetAdd.mockResolvedValue({
      error: 'invalid rpc',
    });

    await expect(
      apiCustomTestnet.addCustomTestnet({ id: 9002 } as never),
    ).resolves.toEqual({ error: 'invalid rpc' });

    expect(mockMatomoRequestEvent).not.toHaveBeenCalled();
  });

  it('returns the larger nonce between custom RPC and local history', async () => {
    mockGetTransactionCount.mockResolvedValue(3);
    mockGetNonceByChain.mockResolvedValue(11);

    await expect(
      apiCustomTestnet.getCustomTestnetNonce({
        address: '0xabc',
        chainId: 9001,
      }),
    ).resolves.toBe(11);

    expect(mockGetTransactionCount).toHaveBeenCalledWith({
      address: '0xabc',
      chainId: 9001,
      blockTag: 'latest',
    });
    expect(mockGetNonceByChain).toHaveBeenCalledWith('0xabc', 9001);
  });

  it('fetches only unknown custom chains used in transaction history', async () => {
    transactionHistoryService.store.transactions = {
      a: { chainId: 1 },
      b: { chainId: 9001 },
      c: { chainId: 9001 },
      d: { chainId: 9002 },
    };
    mockFindChain.mockImplementation(({ id }) => (id === 1 ? { id } : null));
    mockGetChainListByIds.mockResolvedValue([{ id: 9001 }, { id: 9002 }]);

    await expect(
      apiCustomTestnet.getUsedCustomTestnetChainList(),
    ).resolves.toEqual([{ id: 9001 }, { id: 9002 }]);

    expect(mockGetChainListByIds).toHaveBeenCalledWith({
      ids: '9001,9002',
    });
  });
});
