function loadCustomTestnetModule() {
  jest.resetModules();

  const mockAdd = jest.fn();
  const mockGetTransactionCount = jest.fn();
  const mockGetNonceByChain = jest.fn();
  const mockGetChainListByIds = jest.fn();
  const mockMatomoRequestEvent = jest.fn();
  const mockFindChain = jest.fn();

  const transactionHistoryService = {
    getNonceByChain: mockGetNonceByChain,
    store: {
      transactions: {},
    },
  };

  jest.doMock('@/utils/analytics', () => ({
    matomoRequestEvent: (...args: unknown[]) => mockMatomoRequestEvent(...args),
  }));
  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
  }));
  jest.doMock('../request', () => ({
    openapi: {
      getChainListByIds: (...args: unknown[]) => mockGetChainListByIds(...args),
    },
  }));
  jest.doMock('../services/shared', () => ({
    customTestnetService: {
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
    transactionHistoryService,
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
      mockMatomoRequestEvent,
      transactionHistoryService,
    },
  };
}

describe('core/apis/customTestnet', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('records the successful add-network analytics event with the request source', async () => {
    const { apiCustomTestnet, mocks } = loadCustomTestnetModule();
    mocks.mockAdd.mockResolvedValue({
      id: 9001,
      name: 'Local Testnet',
    });

    await expect(
      apiCustomTestnet.addCustomTestnet(
        {
          id: 9001,
          name: 'Local Testnet',
        } as never,
        {
          ga: {
            source: 'dapp',
          },
        },
      ),
    ).resolves.toEqual({
      id: 9001,
      name: 'Local Testnet',
    });

    expect(mocks.mockMatomoRequestEvent).toHaveBeenCalledWith({
      action: 'Success Add Network',
      category: 'Custom Network',
      label: 'dapp_9001',
    });
  });

  it('does not record the success analytics event when add returns an error payload', async () => {
    const { apiCustomTestnet, mocks } = loadCustomTestnetModule();
    mocks.mockAdd.mockResolvedValue({
      error: 'invalid rpc',
    });

    await expect(
      apiCustomTestnet.addCustomTestnet({
        id: 9001,
      } as never),
    ).resolves.toEqual({
      error: 'invalid rpc',
    });

    expect(mocks.mockMatomoRequestEvent).not.toHaveBeenCalled();
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
