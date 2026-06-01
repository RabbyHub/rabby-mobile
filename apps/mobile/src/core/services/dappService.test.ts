type DappStore = {
  dapps: Record<string, Record<string, unknown>>;
};

const INTERNAL_REQUEST_ORIGIN =
  'chrome-extension://acmacodkjbdgmoleebolmdjonilkdbch';

function loadDappServiceModule(initialStore?: DappStore) {
  jest.resetModules();

  const mockCaptureException = jest.fn();
  const mockSafeGetOrigin = jest.fn((url: string) => {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  });

  class MockStoreServiceBase {
    store: DappStore;

    constructor(
      _name: string,
      template: DappStore,
      options: {
        storageAdapter?: {
          store?: DappStore;
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
    safeGetOrigin: (...args: unknown[]) => mockSafeGetOrigin(...args),
  }));
  jest.doMock('@/constant', () => ({
    INTERNAL_REQUEST_ORIGIN,
  }));
  jest.doMock('../storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      dapps: 'dapps',
    },
  }));

  const { DappService } =
    require('./dappService') as typeof import('./dappService');

  return {
    DappService,
    mocks: {
      mockCaptureException,
      mockSafeGetOrigin,
    },
    storageAdapter: {
      store: initialStore,
    },
  };
}

describe('core/services/dappService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('migrates missing or invalid persisted origins and patches known non-dapp sites', () => {
    const { DappService, storageAdapter } = loadDappServiceModule({
      dapps: {
        'https://legacy.example': {
          chainId: 'eth',
          name: 'Legacy',
          origin: 'legacy.example',
        },
      },
    });

    const service = new DappService({
      storageAdapter: storageAdapter as never,
    });

    expect(service.getDapp('https://legacy.example')).toEqual({
      chainId: 'eth',
      name: 'Legacy',
      origin: 'https://legacy.example',
    });
    expect(service.getDapp('https://www.google.com')?.isDapp).toBe(false);
    expect(service.getDapp('https://x.com')?.isDapp).toBe(false);
    expect(service.getDapp('https://github.com')?.isDapp).toBe(false);
  });

  it('adds, updates, removes, and rejects malformed dapp origins', () => {
    const { DappService, mocks } = loadDappServiceModule();
    const service = new DappService();

    service.addDapp([
      {
        chainId: 'eth',
        isConnected: true,
        name: 'App',
        origin: 'https://app.example',
      },
      {
        chainId: 'eth',
        name: 'Other',
        origin: 'https://other.example',
      },
    ] as never);
    service.updateDapp({
      chainId: 'arb',
      icon: 'next-icon',
      name: 'Updated App',
      origin: 'https://app.example',
    } as never);

    expect(service.getDapp('https://app.example')).toEqual({
      chainId: 'arb',
      icon: 'next-icon',
      isConnected: true,
      name: 'Updated App',
      origin: 'https://app.example',
    });

    service.updateDapp({
      chainId: 'eth',
      name: 'Bad',
      origin: 'app.example',
    } as never);
    expect(mocks.mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: {
        dapp: {
          chainId: 'eth',
          name: 'Bad',
          origin: 'app.example',
        },
      },
      tags: {
        scene: 'dappService',
      },
    });
    expect(service.getDapp('app.example')).toBeUndefined();

    service.removeDapp('https://other.example');
    expect(service.getDapp('https://other.example')).toBeUndefined();
  });

  it('tracks favorites, connected dapps, disconnects, and permission checks by safe origin', () => {
    jest.spyOn(Date, 'now').mockReturnValue(123);
    const { DappService, mocks } = loadDappServiceModule();
    const service = new DappService();

    service.addDapp({
      chainId: 'eth',
      isConnected: true,
      name: 'App',
      origin: 'https://app.example',
    } as never);
    service.updateFavorite('https://app.example', true);

    expect(service.getFavoriteDapps()).toEqual([
      expect.objectContaining({
        favoriteAt: 123,
        isFavorite: true,
        origin: 'https://app.example',
      }),
    ]);
    expect(service.getConnectedDapp('https://app.example')).toEqual(
      expect.objectContaining({
        isConnected: true,
      }),
    );
    expect(service.hasPermission(INTERNAL_REQUEST_ORIGIN)).toBe(true);
    expect(service.hasPermission('https://app.example/swap?chain=eth')).toBe(
      true,
    );
    expect(mocks.mockSafeGetOrigin).toHaveBeenCalledWith(
      'https://app.example/swap?chain=eth',
    );

    service.disconnect('https://app.example');

    expect(service.getConnectedDapp('https://app.example')).toBeNull();
    expect(service.hasPermission('https://app.example/swap?chain=eth')).toBe(
      false,
    );
  });
});
