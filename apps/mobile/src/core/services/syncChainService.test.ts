type SyncChainStore = {
  data: {
    chains: Array<Record<string, unknown>>;
    updatedAt: number;
  };
};

let activeTimers: Array<ReturnType<typeof setInterval> | null> = [];

function loadSyncChainServiceModule(initialStore?: SyncChainStore) {
  jest.resetModules();

  const mockAxiosGet = jest.fn();
  const mockSupportedChainToChain = jest.fn(
    (chain: Record<string, unknown>) => ({
      enum: chain.enum,
      id: chain.id,
      name: chain.name,
      serverId: chain.server_id,
    }),
  );
  const mockUpdateChainStore = jest.fn();

  class MockStoreServiceBase {
    store: SyncChainStore;

    constructor(
      _name: string,
      template: SyncChainStore,
      options: {
        storageAdapter?: {
          store?: SyncChainStore;
        };
      },
    ) {
      this.store = options.storageAdapter?.store || template;
    }

    protected mutateStore(recipe: (draft: SyncChainStore) => void) {
      recipe(this.store);
      return this.store;
    }

    getStoreSnapshot() {
      return JSON.parse(JSON.stringify(this.store)) as SyncChainStore;
    }

    getStoreFieldSnapshot<K extends keyof SyncChainStore>(key: K) {
      const value = this.store[key];
      return (
        value === undefined ? value : JSON.parse(JSON.stringify(value))
      ) as SyncChainStore[K];
    }
  }

  jest.doMock('@rabby-wallet/persist-store', () => ({
    StoreServiceBase: MockStoreServiceBase,
  }));
  jest.doMock('@/core/storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      syncChain: 'syncChain',
    },
  }));
  jest.doMock('axios', () => ({
    get: (...args: unknown[]) => mockAxiosGet(...args),
  }));
  jest.doMock('@/isomorphic/chain', () => ({
    supportedChainToChain: (...args: unknown[]) =>
      mockSupportedChainToChain(...args),
  }));
  jest.doMock('@/constant/chains', () => ({
    CHAINS_ENUM: { ETH: 'ETH' },
    updateChainStore: (...args: unknown[]) => mockUpdateChainStore(...args),
  }));

  const { SyncChainService } =
    require('./syncChainService') as typeof import('./syncChainService');

  return {
    SyncChainService,
    mocks: {
      mockAxiosGet,
      mockSupportedChainToChain,
      mockUpdateChainStore,
    },
    storageAdapter: {
      store: initialStore,
    },
  };
}

describe('core/services/syncChainService', () => {
  afterEach(() => {
    activeTimers.forEach(timer => {
      if (timer) {
        clearInterval(timer);
      }
    });
    activeTimers = [];
    jest.useRealTimers();
    jest.resetModules();
  });

  it('hydrates the global chain store from cached chains and skips refresh inside the cooldown window', async () => {
    const now = 5_000_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const cachedChains = [
      {
        enum: 'ETH',
        id: 1,
        name: 'Ethereum',
        serverId: 'eth',
      },
    ];
    const { SyncChainService, mocks, storageAdapter } =
      loadSyncChainServiceModule({
        data: {
          chains: cachedChains,
          updatedAt: now,
        },
      });

    const service = new SyncChainService({
      storageAdapter: storageAdapter as never,
    });
    activeTimers.push(service.timer);
    await service.syncMainnetChainList();

    expect(mocks.mockUpdateChainStore).toHaveBeenCalledWith({
      mainnetList: cachedChains,
    });
    expect(mocks.mockAxiosGet).not.toHaveBeenCalled();
  });

  it('fetches supported chains after cooldown, filters disabled chains, converts them, and updates storage', async () => {
    const now = 6_000_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const { SyncChainService, mocks, storageAdapter } =
      loadSyncChainServiceModule({
        data: {
          chains: [],
          updatedAt: now,
        },
      });
    mocks.mockAxiosGet.mockResolvedValue({
      data: [
        {
          enum: 'ETH',
          id: 1,
          is_disabled: false,
          name: 'Ethereum',
          server_id: 'eth',
        },
        {
          enum: 'disabled',
          id: 999,
          is_disabled: true,
          name: 'Disabled',
          server_id: 'disabled',
        },
      ],
    });
    const service = new SyncChainService({
      storageAdapter: storageAdapter as never,
    });
    activeTimers.push(service.timer);
    service.store.data.updatedAt = 0;

    await service.syncMainnetChainList();

    expect(mocks.mockAxiosGet).toHaveBeenCalledWith(
      'https://static.debank.com/supported_chains.json',
    );
    expect(mocks.mockSupportedChainToChain).toHaveBeenCalledTimes(1);
    expect(mocks.mockSupportedChainToChain).toHaveBeenCalledWith({
      enum: 'ETH',
      id: 1,
      is_disabled: false,
      name: 'Ethereum',
      server_id: 'eth',
    });
    expect(mocks.mockUpdateChainStore).toHaveBeenCalledWith({
      mainnetList: [
        {
          enum: 'ETH',
          id: 1,
          name: 'Ethereum',
          serverId: 'eth',
        },
      ],
    });
    expect(service.store.data).toEqual({
      chains: [
        {
          enum: 'ETH',
          id: 1,
          name: 'Ethereum',
          serverId: 'eth',
        },
      ],
      updatedAt: now,
    });
  });

  it('force refreshes a fresh cached chain list', async () => {
    const now = 7_000_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const { SyncChainService, mocks, storageAdapter } =
      loadSyncChainServiceModule({
        data: {
          chains: [
            {
              enum: 'ETH',
              id: 1,
              name: 'Ethereum',
              serverId: 'eth',
            },
          ],
          updatedAt: now,
        },
      });
    mocks.mockAxiosGet.mockResolvedValue({
      data: [
        {
          enum: 'ETH',
          id: 1,
          is_disabled: false,
          name: 'Ethereum',
          server_id: 'eth',
        },
        {
          enum: 'megaeth',
          id: 4326,
          is_disabled: false,
          name: 'MegaETH',
          server_id: 'megaeth',
        },
      ],
    });

    const service = new SyncChainService({
      storageAdapter: storageAdapter as never,
    });
    activeTimers.push(service.timer);
    await service.syncMainnetChainList({ force: true });

    expect(mocks.mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(mocks.mockUpdateChainStore).toHaveBeenLastCalledWith({
      mainnetList: [
        {
          enum: 'ETH',
          id: 1,
          name: 'Ethereum',
          serverId: 'eth',
        },
        {
          enum: 'megaeth',
          id: 4326,
          name: 'MegaETH',
          serverId: 'megaeth',
        },
      ],
    });
  });

  it('keeps the current list when a fetched list has no enabled ETH', async () => {
    const now = 7_500_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const cachedChains = [
      {
        enum: 'ETH',
        id: 1,
        name: 'Ethereum',
        serverId: 'eth',
      },
    ];
    const { SyncChainService, mocks, storageAdapter } =
      loadSyncChainServiceModule({
        data: {
          chains: cachedChains,
          updatedAt: now,
        },
      });
    mocks.mockAxiosGet.mockResolvedValue({
      data: [
        {
          enum: 'BSC',
          id: 56,
          is_disabled: false,
          name: 'BNB Chain',
          server_id: 'bsc',
        },
        {
          enum: 'ETH',
          id: 1,
          is_disabled: true,
          name: 'Ethereum',
          server_id: 'eth',
        },
      ],
    });
    const onMainnetChainListUpdated = jest.fn();

    try {
      const service = new SyncChainService({
        storageAdapter: storageAdapter as never,
        onMainnetChainListUpdated,
      });
      activeTimers.push(service.timer);
      mocks.mockUpdateChainStore.mockClear();
      await service.syncMainnetChainList({ force: true });

      expect(mocks.mockUpdateChainStore).not.toHaveBeenCalled();
      expect(service.store.data).toEqual({
        chains: cachedChains,
        updatedAt: now,
      });
      expect(onMainnetChainListUpdated).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('notifies once a fetched list replaces the current one, not when the fetch fails', async () => {
    const now = 7_800_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { SyncChainService, mocks, storageAdapter } =
      loadSyncChainServiceModule({
        data: {
          chains: [
            {
              enum: 'ETH',
              id: 1,
              name: 'Ethereum',
              serverId: 'eth',
            },
          ],
          updatedAt: now,
        },
      });
    const onMainnetChainListUpdated = jest.fn(() => {
      expect(mocks.mockUpdateChainStore).toHaveBeenLastCalledWith({
        mainnetList: [
          {
            enum: 'ETH',
            id: 1,
            name: 'Ethereum',
            serverId: 'eth',
          },
        ],
      });
    });

    try {
      const service = new SyncChainService({
        storageAdapter: storageAdapter as never,
        onMainnetChainListUpdated,
      });
      activeTimers.push(service.timer);

      mocks.mockAxiosGet.mockRejectedValueOnce(new Error('network'));
      await service.syncMainnetChainList({ force: true });
      expect(onMainnetChainListUpdated).not.toHaveBeenCalled();

      mocks.mockAxiosGet.mockResolvedValueOnce({
        data: [
          {
            enum: 'ETH',
            id: 1,
            is_disabled: false,
            name: 'Ethereum',
            server_id: 'eth',
          },
        ],
      });
      await service.syncMainnetChainList({ force: true });
      expect(onMainnetChainListUpdated).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('deduplicates concurrent remote chain refreshes', async () => {
    const now = 8_000_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const { SyncChainService, mocks, storageAdapter } =
      loadSyncChainServiceModule({
        data: {
          chains: [],
          updatedAt: 0,
        },
      });
    let resolveRequest!: (value: { data: unknown[] }) => void;
    mocks.mockAxiosGet.mockReturnValue(
      new Promise(resolve => {
        resolveRequest = resolve;
      }),
    );

    const service = new SyncChainService({
      storageAdapter: storageAdapter as never,
    });
    activeTimers.push(service.timer);
    const firstRequest = service.syncMainnetChainList();
    const secondRequest = service.syncMainnetChainList({ force: true });

    expect(firstRequest).toBe(secondRequest);
    expect(mocks.mockAxiosGet).toHaveBeenCalledTimes(1);

    resolveRequest({
      data: [
        {
          enum: 'ETH',
          id: 1,
          is_disabled: false,
          name: 'Ethereum',
          server_id: 'eth',
        },
      ],
    });
    await firstRequest;
  });
});
