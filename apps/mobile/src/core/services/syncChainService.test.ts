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
        enum: 'eth',
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
          enum: 'eth',
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
      enum: 'eth',
      id: 1,
      is_disabled: false,
      name: 'Ethereum',
      server_id: 'eth',
    });
    expect(mocks.mockUpdateChainStore).toHaveBeenCalledWith({
      mainnetList: [
        {
          enum: 'eth',
          id: 1,
          name: 'Ethereum',
          serverId: 'eth',
        },
      ],
    });
    expect(service.store.data).toEqual({
      chains: [
        {
          enum: 'eth',
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
              enum: 'eth',
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
          enum: 'megaeth',
          id: 4326,
          name: 'MegaETH',
          serverId: 'megaeth',
        },
      ],
    });
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

    resolveRequest({ data: [] });
    await firstRequest;
  });
});
