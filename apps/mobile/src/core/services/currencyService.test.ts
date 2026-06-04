type CurrencyStore = {
  data: {
    currency: string;
    currencyList: unknown[];
    updatedAt: number;
  };
};

let activeCurrencyTimers: Array<ReturnType<typeof setInterval> | null> = [];

function loadCurrencyServiceModule(initialStore?: CurrencyStore) {
  jest.resetModules();

  const mockGetCurrencyList = jest.fn();

  class MockStoreServiceBase {
    store: CurrencyStore;

    constructor(
      _name: string,
      template: CurrencyStore,
      options: {
        storageAdapter?: {
          store?: CurrencyStore;
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
      currency: 'currency',
    },
  }));
  jest.doMock('../request', () => ({
    openapi: {
      getCurrencyList: (...args: unknown[]) => mockGetCurrencyList(...args),
    },
  }));

  const { CurrencyService } =
    require('./currencyService') as typeof import('./currencyService');

  return {
    CurrencyService,
    mocks: {
      mockGetCurrencyList,
    },
    storageAdapter: {
      store: initialStore,
    },
  };
}

describe('core/services/currencyService', () => {
  afterEach(() => {
    activeCurrencyTimers.forEach(timer => {
      if (timer) {
        clearInterval(timer);
      }
    });
    activeCurrencyTimers = [];
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('skips non-forced currency refreshes inside the cooldown window', async () => {
    const now = 1_000_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const { CurrencyService, mocks, storageAdapter } =
      loadCurrencyServiceModule({
        data: {
          currency: 'USD',
          currencyList: [],
          updatedAt: now,
        },
      });
    mocks.mockGetCurrencyList.mockResolvedValue([]);

    const service = new CurrencyService({
      storageAdapter: storageAdapter as never,
    });
    activeCurrencyTimers.push(service.timer);
    await Promise.resolve();
    mocks.mockGetCurrencyList.mockClear();

    await service.syncCurrencyList();

    expect(mocks.mockGetCurrencyList).not.toHaveBeenCalled();
  });

  it('force refreshes the currency list and updates the timestamp', async () => {
    const now = 2_000_000;
    jest.useFakeTimers().setSystemTime(new Date(now));
    const { CurrencyService, mocks, storageAdapter } =
      loadCurrencyServiceModule({
        data: {
          currency: 'USD',
          currencyList: [],
          updatedAt: now,
        },
      });
    mocks.mockGetCurrencyList.mockResolvedValue([
      {
        code: 'USD',
        symbol: '$',
      },
    ]);

    const service = new CurrencyService({
      storageAdapter: storageAdapter as never,
    });
    activeCurrencyTimers.push(service.timer);
    await Promise.resolve();

    expect(service.store.data.currencyList).toEqual([
      {
        code: 'USD',
        symbol: '$',
      },
    ]);
    expect(service.store.data.updatedAt).toBe(now);
  });
});
