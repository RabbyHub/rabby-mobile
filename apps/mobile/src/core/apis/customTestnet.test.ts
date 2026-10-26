function loadCustomTestnetModule() {
  jest.resetModules();

  const mockAdd = jest.fn();
  const mockGetTransactionCount = jest.fn();
  const mockGetNonceByChain = jest.fn();
  const mockGetChainListByIds = jest.fn();
  const mockFindChain = jest.fn();

  const transactionHistoryService = {
    getNonceByChain: mockGetNonceByChain,
    store: {
      transactions: {},
    },
  };

  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
  }));
  jest.doMock('../request', () => ({
    openapi: {
      getChainListByIds: (...args: unknown[]) => mockGetChainListByIds(...args),
    },
  }));
  jest.doMock('@/core/serviceApi/customTestnet', () => ({
    customTestnetServiceApi: {
      add: mockAdd,
      addToken: jest.fn(),
      estimateGas: jest.fn(),
      getGasMarket: jest.fn(),
      getGasPrice: jest.fn(),
      getList: jest.fn(),
      getToken: jest.fn(),
      getTokenList: jest.fn(),
      getTransactionCount: mockGetTransactionCount,
      getTransactionReceipt: jest.fn(),
      getTx: jest.fn(),
      hasToken: jest.fn(),
      remove: jest.fn(),
      removeToken: jest.fn(),
      update: jest.fn(),
    },
  }));
  jest.doMock('@/core/serviceApi/transactionHistory', () => ({
    getTransactionHistoryTransactions: async () =>
      Object.values(transactionHistoryService.store.transactions),
    transactionHistoryServiceApi: {
      getNonceByChain: (...args: unknown[]) => mockGetNonceByChain(...args),
    },
  }));
  const { apiCustomTestnet } =
    require('./customTestnet') as typeof import('./customTestnet');

  return {
    apiCustomTestnet,
    mocks: {
      mockAdd,
      mockFindChain,
      mockGetChainListByIds,
      mockGetNonceByChain,
      mockGetTransactionCount,
      transactionHistoryService,
    },
  };
}

describe('core/apis/customTestnet', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('uses the larger value between on-chain and local custom-testnet nonce', async () => {
    const { apiCustomTestnet, mocks } = loadCustomTestnetModule();
    mocks.mockGetTransactionCount.mockResolvedValue(3);
    mocks.mockGetNonceByChain.mockResolvedValue(8);

    await expect(
      apiCustomTestnet.getCustomTestnetNonce({
        address: '0xabc',
        chainId: 9001,
      }),
    ).resolves.toBe(8);

    expect(mocks.mockGetTransactionCount).toHaveBeenCalledWith({
      address: '0xabc',
      blockTag: 'latest',
      chainId: 9001,
    });
    expect(mocks.mockGetNonceByChain).toHaveBeenCalledWith('0xabc', 9001);
  });

  it('loads only transaction-history chain ids that are not already built-in chains', async () => {
    const { apiCustomTestnet, mocks } = loadCustomTestnetModule();
    mocks.transactionHistoryService.store.transactions = {
      builtin: {
        chainId: 1,
      },
      customA: {
        chainId: 9001,
      },
      customADuplicate: {
        chainId: 9001,
      },
      customB: {
        chainId: 9002,
      },
    };
    mocks.mockFindChain.mockImplementation(({ id }) =>
      id === 1
        ? {
            enum: 'eth',
            id: 1,
          }
        : null,
    );
    mocks.mockGetChainListByIds.mockResolvedValue([
      {
        id: 9001,
      },
      {
        id: 9002,
      },
    ]);

    await expect(
      apiCustomTestnet.getUsedCustomTestnetChainList(),
    ).resolves.toEqual([
      {
        id: 9001,
      },
      {
        id: 9002,
      },
    ]);

    expect(mocks.mockGetChainListByIds).toHaveBeenCalledWith({
      ids: '9001,9002',
    });
  });
});
