type BrowserHistoryStore = {
  browserHistory: Record<
    string,
    {
      createdAt: number;
      origin: string;
    }
  >;
};

function loadBrowserHistoryModule(initialStore?: BrowserHistoryStore) {
  jest.resetModules();

  class MockStoreServiceBase {
    store: BrowserHistoryStore;

    constructor(
      _name: string,
      template: BrowserHistoryStore,
      options: {
        storageAdapter?: {
          store?: BrowserHistoryStore;
        };
      },
    ) {
      this.store = options.storageAdapter?.store || template;
    }
  }

  jest.doMock('@rabby-wallet/persist-store', () => ({
    StoreServiceBase: MockStoreServiceBase,
  }));
  jest.doMock('../storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      browserHistory: 'browserHistory',
    },
  }));

  const { BrowserHistoryService } =
    require('./browserHistoryService') as typeof import('./browserHistoryService');

  return {
    BrowserHistoryService,
    storageAdapter: {
      store: initialStore,
    },
  };
}

describe('core/services/browserHistoryService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('lowercases recent persisted origins and drops entries older than 30 days', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
    const recentCreatedAt = 1_000_000_000_000 - 24 * 60 * 60 * 1000;
    const oldCreatedAt = 1_000_000_000_000 - 31 * 24 * 60 * 60 * 1000;
    const { BrowserHistoryService, storageAdapter } = loadBrowserHistoryModule({
      browserHistory: {
        'HTTPS://OLD.EXAMPLE': {
          createdAt: oldCreatedAt,
          origin: 'HTTPS://OLD.EXAMPLE',
        },
        'HTTPS://RECENT.EXAMPLE': {
          createdAt: recentCreatedAt,
          origin: 'HTTPS://RECENT.EXAMPLE',
        },
      },
    });

    const service = new BrowserHistoryService({
      storageAdapter: storageAdapter as never,
    });

    expect(service.store.browserHistory).toEqual({
      'https://recent.example': {
        createdAt: recentCreatedAt,
        origin: 'HTTPS://RECENT.EXAMPLE',
      },
    });
  });

  it('stores, lists, queries, and removes browser history by normalized origin', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const { BrowserHistoryService } = loadBrowserHistoryModule();
    const service = new BrowserHistoryService();

    service.setHistory({
      createdAt: 10,
      origin: 'HTTPS://FIRST.EXAMPLE',
    });
    service.setHistory({
      createdAt: 20,
      origin: 'https://second.example',
    });

    expect(service.hasHistory('https://FIRST.example')).toBe(true);
    expect(service.getHistory('https://first.example')).toEqual({
      createdAt: 10,
      origin: 'https://first.example',
    });
    expect(service.getHistoryList()).toEqual([
      {
        createdAt: 20,
        origin: 'https://second.example',
      },
      {
        createdAt: 10,
        origin: 'https://first.example',
      },
    ]);

    service.removeHistory('HTTPS://FIRST.EXAMPLE');

    expect(service.hasHistory('https://first.example')).toBe(false);
    expect(service.getHistoryList()).toEqual([
      {
        createdAt: 20,
        origin: 'https://second.example',
      },
    ]);
  });
});
