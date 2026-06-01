type BrowserStore = {
  browserBookmarks: {
    entities: Record<string, Record<string, unknown>>;
    ids: string[];
  };
  browserHistory: {
    entities: Record<string, Record<string, unknown>>;
    ids: string[];
  };
  browserTabs: {
    activeTabId: string;
    tabs: Array<Record<string, unknown>>;
  };
  config: {
    isMigrated?: boolean;
  };
};

function createBrowserStore(
  overrides: Partial<BrowserStore> = {},
): BrowserStore {
  return {
    browserBookmarks: {
      entities: {},
      ids: [],
    },
    browserHistory: {
      entities: {},
      ids: [],
    },
    browserTabs: {
      activeTabId: '',
      tabs: [],
    },
    config: {
      isMigrated: true,
    },
    ...overrides,
  };
}

function loadBrowserServiceModule({
  initialStore = createBrowserStore(),
  legacyStores = {},
}: {
  initialStore?: BrowserStore;
  legacyStores?: Record<string, unknown>;
} = {}) {
  jest.resetModules();

  const mockCaptureException = jest.fn();
  const mockCopyFile = jest.fn();
  const mockExists = jest.fn();
  const mockGetItem = jest.fn((key: string) => legacyStores[key]);
  const mockGetViewShotFilePath = jest.fn((name: string) => `/doc/${name}`);
  const mockUnlink = jest.fn();

  class MockStoreServiceBase {
    store: BrowserStore;

    constructor(
      _name: string,
      template: BrowserStore,
      options: {
        storageAdapter?: {
          store?: BrowserStore;
        };
      },
    ) {
      this.store = options.storageAdapter?.store || template;
    }
  }

  jest.doMock('@rabby-wallet/persist-store', () => ({
    StoreServiceBase: MockStoreServiceBase,
  }));
  jest.doMock('@sentry/react-native', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
  }));
  jest.doMock('@rabby-wallet/base-utils/dist/isomorphic/url', () => ({
    safeGetOrigin: (url: string) => {
      try {
        return new URL(url).origin;
      } catch {
        return url;
      }
    },
    safeParseURL: (url: string) => {
      try {
        return new URL(url);
      } catch {
        return null;
      }
    },
  }));
  jest.doMock('react-native-fs', () => ({
    DocumentDirectoryPath: '/doc',
    copyFile: (...args: unknown[]) => mockCopyFile(...args),
    exists: (...args: unknown[]) => mockExists(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  }));
  jest.doMock('@/utils/browser', () => ({
    getViewShotFilePath: (...args: unknown[]) =>
      mockGetViewShotFilePath(...args),
  }));
  jest.doMock('../storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      browser: 'browser',
      browserHistory: 'browserHistory',
      dapps: 'dapps',
    },
  }));

  const { BrowserService } =
    require('./browserService') as typeof import('./browserService');

  return {
    BrowserService,
    mocks: {
      mockCaptureException,
      mockCopyFile,
      mockExists,
      mockGetItem,
      mockGetViewShotFilePath,
      mockUnlink,
    },
    storageAdapter: {
      getItem: mockGetItem,
      store: initialStore,
    },
  };
}

describe('core/services/browserService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('migrates legacy dapp favorites/history and sanitizes restored tabs', () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const { BrowserService, storageAdapter } = loadBrowserServiceModule({
      initialStore: createBrowserStore({
        browserTabs: {
          activeTabId: 'missing-tab',
          tabs: [
            {
              id: 'valid-tab',
              initialUrl: '',
              openTime: 1,
              url: 'https://valid.example/path',
            },
            {
              id: 'invalid-tab',
              initialUrl: '',
              openTime: 2,
              url: 'about:blank',
            },
          ],
        },
        config: {
          isMigrated: false,
        },
      }),
      legacyStores: {
        browserHistory: {
          browserHistory: {
            'https://fav.example': {
              createdAt: 1_999_999_000,
              origin: 'https://fav.example',
            },
          },
        },
        dapps: {
          dapps: {
            'https://fav.example': {
              favoriteAt: 1_999_998_000,
              isFavorite: true,
              name: 'Favorite',
              origin: 'https://fav.example',
            },
          },
        },
      },
    });

    const service = new BrowserService({
      storageAdapter: storageAdapter as never,
    });

    expect(service.store.config.isMigrated).toBe(true);
    expect(service.store.browserBookmarks).toEqual({
      entities: {
        'https://fav.example/': {
          createdAt: 1_999_998_000,
          name: 'Favorite',
          url: 'https://fav.example/',
        },
      },
      ids: ['https://fav.example/'],
    });
    expect(service.store.browserHistory).toEqual({
      entities: {
        'https://fav.example': {
          createdAt: 1_999_999_000,
          name: 'Favorite',
          url: 'https://fav.example',
        },
      },
      ids: ['https://fav.example'],
    });
    expect(service.store.browserTabs).toEqual({
      activeTabId: 'valid-tab',
      tabs: [
        {
          id: 'valid-tab',
          initialUrl: 'https://valid.example/path',
          isTerminate: true,
          openTime: 1,
          url: 'https://valid.example/path',
        },
      ],
    });
  });

  it('keeps bookmark/history entity tools sorted and clearBrowserData resets history and tabs', () => {
    const { BrowserService } = loadBrowserServiceModule();
    const service = new BrowserService();

    service.bookmark.addMany([
      {
        createdAt: 10,
        url: 'https://old.example',
      },
      {
        createdAt: 20,
        url: 'https://new.example',
      },
    ]);
    service.history.addMany([
      {
        createdAt: 30,
        url: 'https://history.example',
      },
    ]);
    service.updateBrowserTabs({
      activeTabId: 'tab-1',
      tabs: [
        {
          id: 'tab-1',
          initialUrl: 'https://tab.example',
          openTime: 1,
          url: 'https://tab.example',
        },
      ],
    });

    expect(service.store.browserBookmarks.ids).toEqual([
      'https://new.example',
      'https://old.example',
    ]);
    expect(service.store.browserHistory.ids).toEqual([
      'https://history.example',
    ]);

    service.clearBrowserData();

    expect(service.store.browserBookmarks.ids).toEqual([
      'https://new.example',
      'https://old.example',
    ]);
    expect(service.store.browserHistory).toEqual({
      entities: {},
      ids: [],
    });
    expect(service.store.browserTabs).toEqual({
      activeTabId: '',
      tabs: [],
    });
  });

  it('replaces tab screenshots by deleting old files and copying the new one', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(123);
    const { BrowserService, mocks, storageAdapter } = loadBrowserServiceModule({
      initialStore: createBrowserStore({
        browserTabs: {
          activeTabId: 'tab-1',
          tabs: [
            {
              id: 'tab-1',
              initialUrl: 'https://tab.example',
              openTime: 1,
              url: 'https://tab.example',
              viewShot: 'old-shot.jpg',
            },
          ],
        },
      }),
    });
    mocks.mockExists.mockImplementation((path: string) =>
      Promise.resolve(path === '/doc/old-shot.jpg'),
    );
    mocks.mockUnlink.mockResolvedValue(undefined);
    mocks.mockCopyFile.mockResolvedValue(undefined);
    const service = new BrowserService({
      storageAdapter: storageAdapter as never,
    });

    await expect(
      service.saveScreenshot({
        tabId: 'tab-1',
        tempUri: '/tmp/new.jpg',
      }),
    ).resolves.toBe('screenshot-tab-1-123.jpg');

    expect(mocks.mockGetViewShotFilePath).toHaveBeenCalledWith('old-shot.jpg');
    expect(mocks.mockUnlink).toHaveBeenCalledWith('/doc/old-shot.jpg');
    expect(mocks.mockCopyFile).toHaveBeenCalledWith(
      '/tmp/new.jpg',
      '/doc/screenshot-tab-1-123.jpg',
    );
  });
});
