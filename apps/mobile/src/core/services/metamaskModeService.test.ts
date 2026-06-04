type MetamaskModeStore = {
  data: {
    sites: string[];
    updatedAt: number;
  };
};

let activeMetamaskTimers: Array<ReturnType<typeof setInterval> | null> = [];

function loadMetamaskModeServiceModule(initialStore?: MetamaskModeStore) {
  jest.resetModules();

  const mockAxiosGet = jest.fn();

  class MockStoreServiceBase {
    store: MetamaskModeStore;

    constructor(
      _name: string,
      template: MetamaskModeStore,
      options: {
        storageAdapter?: {
          store?: MetamaskModeStore;
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
      metamaskMode: 'metamaskMode',
    },
  }));
  jest.doMock('axios', () => ({
    get: (...args: unknown[]) => mockAxiosGet(...args),
  }));

  const { MetamaskModeService } =
    require('./metamaskModeService') as typeof import('./metamaskModeService');

  return {
    MetamaskModeService,
    mocks: {
      mockAxiosGet,
    },
    storageAdapter: {
      store: initialStore,
    },
  };
}

describe('core/services/metamaskModeService', () => {
  afterEach(() => {
    activeMetamaskTimers.forEach(timer => {
      if (timer) {
        clearInterval(timer);
      }
    });
    activeMetamaskTimers = [];
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('skips remote refreshes inside the cooldown window and matches origins without protocol', async () => {
    const now = 3_000_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const { MetamaskModeService, mocks, storageAdapter } =
      loadMetamaskModeServiceModule({
        data: {
          sites: ['fake.example'],
          updatedAt: now,
        },
      });

    const service = new MetamaskModeService({
      storageAdapter: storageAdapter as never,
    });
    activeMetamaskTimers.push(service.timer);
    await service.syncMetamaskModeList();

    expect(mocks.mockAxiosGet).not.toHaveBeenCalled();
    expect(service.checkIsMetamaskMode('https://fake.example')).toBe(true);
    expect(service.checkIsMetamaskMode('http://fake.example')).toBe(true);
    expect(service.checkIsMetamaskMode('https://other.example')).toBe(false);
  });

  it('refreshes the metamask-mode site list after the cooldown expires', async () => {
    const now = 4_000_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const { MetamaskModeService, mocks, storageAdapter } =
      loadMetamaskModeServiceModule({
        data: {
          sites: [],
          updatedAt: now,
        },
      });
    mocks.mockAxiosGet.mockResolvedValue({
      data: ['next.example'],
    });
    const service = new MetamaskModeService({
      storageAdapter: storageAdapter as never,
    });
    activeMetamaskTimers.push(service.timer);
    service.store.data.updatedAt = 0;

    await service.syncMetamaskModeList();

    expect(mocks.mockAxiosGet).toHaveBeenCalledWith(
      'https://static.debank.com/fake_mm_dapps.json',
    );
    expect(service.store.data).toEqual({
      sites: ['next.example'],
      updatedAt: now,
    });
  });
});
