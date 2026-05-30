type RpcCacheInstance = typeof import('./rpcCache').default;

let activeRpcCache: RpcCacheInstance | null = null;

function loadRpcCacheModule(
  chainList: Array<{
    serverId: string;
  }> = [
    {
      serverId: 'eth',
    },
  ],
) {
  jest.resetModules();

  const mockGetChainList = jest.fn(() => chainList);

  jest.doMock('@/constant/chains', () => ({
    getChainList: (...args: unknown[]) => mockGetChainList(...args),
  }));

  const RpcCache = require('./rpcCache').default as RpcCacheInstance;
  RpcCache.state.clear();
  RpcCache.latestBlockNumber = {};
  activeRpcCache = RpcCache;

  return {
    RpcCache,
    mocks: {
      mockGetChainList,
    },
  };
}

describe('core/services/rpcCache', () => {
  afterEach(() => {
    activeRpcCache?.state.forEach(({ timeoutId }) => {
      clearTimeout(timeoutId);
    });
    activeRpcCache?.state.clear();
    activeRpcCache = null;
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('caches only allow-listed read-only RPC methods', () => {
    const { RpcCache } = loadRpcCacheModule();
    RpcCache.latestBlockNumber = {
      eth: '100',
    };

    expect(
      RpcCache.canCache({
        method: 'eth_call',
        params: [],
      }),
    ).toBe(true);
    expect(
      RpcCache.canCache({
        method: 'eth_sendTransaction',
        params: [],
      }),
    ).toBe(false);

    RpcCache.set('0xabc', {
      chainId: 'eth',
      method: 'eth_sendTransaction',
      params: [],
      result: '0xnot-cached',
    });

    expect(RpcCache.state.size).toBe(0);
    expect(
      RpcCache.get('0xabc', {
        chainId: 'eth',
        method: 'eth_sendTransaction',
        params: [],
      }),
    ).toBeUndefined();
  });

  it('scopes cached results by address, method, params, chain, and latest block marker', () => {
    const { RpcCache } = loadRpcCacheModule();
    RpcCache.latestBlockNumber = {
      eth: '100',
    };

    RpcCache.set('0xabc', {
      chainId: 'eth',
      method: 'eth_call',
      params: [
        {
          to: '0xcontract',
        },
      ],
      result: '0xresult',
    });

    expect(
      RpcCache.has('0xabc', {
        chainId: 'eth',
        method: 'eth_call',
        params: [
          {
            to: '0xcontract',
          },
        ],
      }),
    ).toBe(true);
    expect(
      RpcCache.get('0xother', {
        chainId: 'eth',
        method: 'eth_call',
        params: [
          {
            to: '0xcontract',
          },
        ],
      }),
    ).toBeUndefined();

    RpcCache.latestBlockNumber = {
      eth: '101',
    };
    expect(
      RpcCache.get('0xabc', {
        chainId: 'eth',
        method: 'eth_call',
        params: [
          {
            to: '0xcontract',
          },
        ],
      }),
    ).toBeUndefined();
  });

  it('expires newly inserted cache entries after their timeout', () => {
    jest.useFakeTimers();
    const { RpcCache } = loadRpcCacheModule();
    RpcCache.latestBlockNumber = {
      eth: '100',
    };

    RpcCache.set(
      '0xabc',
      {
        chainId: 'eth',
        method: 'eth_blockNumber',
        params: [],
        result: '0x1',
      },
      100,
    );

    expect(
      RpcCache.get('0xabc', {
        chainId: 'eth',
        method: 'eth_blockNumber',
        params: [],
      }),
    ).toBe('0x1');

    jest.advanceTimersByTime(100);

    expect(
      RpcCache.get('0xabc', {
        chainId: 'eth',
        method: 'eth_blockNumber',
        params: [],
      }),
    ).toBeUndefined();
  });

  it('replaces an existing cache entry and clears the old expiry timer', () => {
    jest.useFakeTimers();
    const { RpcCache } = loadRpcCacheModule();
    RpcCache.latestBlockNumber = {
      eth: '100',
    };
    const key = {
      chainId: 'eth',
      method: 'eth_gasPrice',
      params: [],
    };

    RpcCache.set(
      '0xabc',
      {
        ...key,
        result: '0xold',
      },
      100,
    );
    jest.advanceTimersByTime(50);
    RpcCache.set(
      '0xabc',
      {
        ...key,
        result: '0xnew',
      },
      100,
    );
    jest.advanceTimersByTime(60);

    expect(RpcCache.get('0xabc', key)).toBe('0xnew');

    jest.advanceTimersByTime(40);

    expect(RpcCache.get('0xabc', key)).toBeUndefined();
  });

  it('extends an existing cache entry with updateExpire', () => {
    jest.useFakeTimers();
    const { RpcCache } = loadRpcCacheModule();
    RpcCache.latestBlockNumber = {
      eth: '100',
    };
    const key = {
      chainId: 'eth',
      method: 'eth_estimateGas',
      params: [
        {
          from: '0xabc',
        },
      ],
    };

    RpcCache.set(
      '0xabc',
      {
        ...key,
        result: '0x5208',
      },
      100,
    );
    jest.advanceTimersByTime(80);
    RpcCache.updateExpire('0xabc', key, 100);
    jest.advanceTimersByTime(30);

    expect(RpcCache.get('0xabc', key)).toBe('0x5208');

    jest.advanceTimersByTime(70);

    expect(RpcCache.get('0xabc', key)).toBeUndefined();
  });

  it('refreshes latest block markers from the mainnet chain list', async () => {
    const { RpcCache, mocks } = loadRpcCacheModule([
      {
        serverId: 'eth',
      },
      {
        serverId: 'arb',
      },
    ]);
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.1234)
      .mockReturnValueOnce(0.9876);

    await RpcCache.loadBlockNumber();

    expect(mocks.mockGetChainList).toHaveBeenCalledWith('mainnet');
    expect(RpcCache.latestBlockNumber).toEqual({
      arb: 9876,
      eth: 1234,
    });
  });
});
