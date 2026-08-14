import type { StorageAdapater } from '@rabby-wallet/persist-store';

import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

import {
  PerpsService,
  type PerpsProPreferences,
  type PerpsServiceStore,
} from './perpsService';

const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

const createMemoryStorage = (
  initialPerpsStore?: Omit<Partial<PerpsServiceStore>, 'proPreferences'> & {
    proPreferences?: unknown;
  },
) => {
  const values = new Map<string, unknown>();
  if (initialPerpsStore) {
    values.set(APP_STORE_NAMES.perps, clone(initialPerpsStore));
  }

  const storage: StorageAdapater = {
    getItem: key => clone(values.get(String(key))),
    setItem: (key, value) => {
      values.set(String(key), clone(value));
    },
    removeItem: key => {
      values.delete(String(key));
    },
    clearAll: () => {
      values.clear();
    },
  };

  return {
    readPerpsStore: () =>
      clone(values.get(APP_STORE_NAMES.perps)) as PerpsServiceStore | undefined,
    storage,
  };
};

const keyringCrypto = {
  decryptWithPassword: jest.fn(async () => ({})),
  encryptWithPassword: jest.fn(async (value: unknown) => JSON.stringify(value)),
  isUnlocked: jest.fn(() => true),
};

const createService = (storage: StorageAdapater) =>
  new PerpsService({
    keyringCrypto,
    storageAdapter: storage,
  });

const defaultTradePreferences = {
  skipPositionTpSlDoubleConfirmation: false,
  skipTradeConfirmationByOrderType: {
    conditional: false,
    limit: false,
    market: false,
  },
  tradeAmountUnit: 'quote' as const,
  tradeOrderType: 'market' as const,
};

describe('PerpsService Pro preferences', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('defaults to Simple when no preference has been persisted', async () => {
    const { storage } = createMemoryStorage();
    const service = createService(storage);

    await expect(service.getPerpsViewMode()).resolves.toBe('simple');
    await expect(service.getPerpsProInfoTab()).resolves.toBe('account');
    await expect(service.getSkipPerpsProLimitCloseConfirmation()).resolves.toBe(
      false,
    );
    await expect(
      service.getSkipPerpsProPositionTpSlConfirmation(),
    ).resolves.toBe(false);
    await expect(service.getPerpsProTradeAmountUnit()).resolves.toBe('quote');
    await expect(service.getPerpsProTradeOrderType()).resolves.toBe('market');
  });

  it('round-trips the selected mode through the real persisted store', async () => {
    const { storage } = createMemoryStorage();
    const firstService = createService(storage);

    await firstService.setPerpsViewMode('pro');
    await expect(firstService.getPerpsViewMode()).resolves.toBe('pro');

    jest.advanceTimersByTime(1000);

    const rehydratedService = createService(storage);
    await expect(rehydratedService.getPerpsViewMode()).resolves.toBe('pro');
  });

  it('round-trips Pro trade preferences without changing Position sizeUnit', async () => {
    const { readPerpsStore, storage } = createMemoryStorage();
    const service = createService(storage);

    await service.setPerpsProTradeAmountUnit('base');
    await service.setPerpsProTradeOrderType('conditional');
    await service.setSkipPerpsProTradeConfirmation('conditional', true);
    jest.advanceTimersByTime(1000);

    const rehydratedService = createService(storage);
    await expect(rehydratedService.getPerpsProTradeAmountUnit()).resolves.toBe(
      'base',
    );
    await expect(rehydratedService.getPerpsProTradeOrderType()).resolves.toBe(
      'conditional',
    );
    await expect(
      rehydratedService.getSkipPerpsProTradeConfirmation('conditional'),
    ).resolves.toBe(true);
    expect(readPerpsStore()?.proPreferences).not.toHaveProperty('sizeUnit');
  });

  it.each([
    ['5M', '5m'],
    ['15M', '15m'],
    ['1H', '1h'],
    ['4H', '4h'],
    ['1D', '1d'],
    ['1W', '1w'],
  ])('migrates legacy Kline interval %s to %s', async (legacy, canonical) => {
    const { readPerpsStore, storage } = createMemoryStorage({
      selectedKlineInterval:
        legacy as unknown as PerpsServiceStore['selectedKlineInterval'],
    });
    const service = createService(storage);

    await expect(service.getSelectedKlineInterval()).resolves.toBe(canonical);
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.selectedKlineInterval).toBe(canonical);
  });

  it('preserves the case-sensitive natural-month interval', async () => {
    const { readPerpsStore, storage } = createMemoryStorage();
    const service = createService(storage);

    await service.setSelectedKlineInterval('1M');
    await expect(service.getSelectedKlineInterval()).resolves.toBe('1M');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.selectedKlineInterval).toBe('1M');
  });

  it('repairs an unknown persisted Kline interval to the 15m default', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      selectedKlineInterval:
        'YTD' as unknown as PerpsServiceStore['selectedKlineInterval'],
    });
    const service = createService(storage);

    await expect(service.getSelectedKlineInterval()).resolves.toBe('15m');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.selectedKlineInterval).toBe('15m');
  });

  it('rejects an invalid Kline interval at the service boundary', async () => {
    const { storage } = createMemoryStorage();
    const service = createService(storage);

    await expect(
      service.setSelectedKlineInterval(
        '1month' as unknown as PerpsServiceStore['selectedKlineInterval'],
      ),
    ).rejects.toThrow('Invalid Perps candle interval');
  });

  it.each([
    {
      label: 'a non-object preference',
      preferences: 'pro',
    },
    {
      label: 'a non-finite version',
      preferences: { version: Number.POSITIVE_INFINITY, viewMode: 'pro' },
    },
    {
      label: 'an old version',
      preferences: { version: 0, viewMode: 'pro' },
    },
    {
      label: 'an invalid mode',
      preferences: { version: 1, viewMode: 'advanced' },
    },
  ])('falls back to Simple for $label', async ({ preferences }) => {
    const { storage } = createMemoryStorage({
      proPreferences: preferences as PerpsProPreferences,
    });
    const service = createService(storage);

    await expect(service.getPerpsViewMode()).resolves.toBe('simple');
  });

  it('reads a valid mode from a future schema without downgrading it', async () => {
    const futurePreferences = {
      version: 8,
      viewMode: 'pro',
      activeInfoTab: 'positions',
      skipLimitCloseDoubleConfirmation: true,
      ...defaultTradePreferences,
      sizeUnit: 'base',
      futureFlag: 'preserve-me',
    } satisfies PerpsProPreferences;
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: futurePreferences,
    });
    const service = createService(storage);

    await expect(service.getPerpsViewMode()).resolves.toBe('pro');
    await expect(service.getPerpsProInfoTab()).resolves.toBe('positions');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual(futurePreferences);
  });

  it('preserves future schema fields when writing a new mode', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: {
        version: 8,
        viewMode: 'simple',
        activeInfoTab: 'openOrders',
        skipLimitCloseDoubleConfirmation: false,
        ...defaultTradePreferences,
        sizeUnit: 'base',
        futureFlag: { enabled: true },
      },
    });
    const service = createService(storage);

    await service.setPerpsViewMode('pro');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 8,
      viewMode: 'pro',
      activeInfoTab: 'openOrders',
      skipLimitCloseDoubleConfirmation: false,
      ...defaultTradePreferences,
      sizeUnit: 'base',
      futureFlag: { enabled: true },
    });
  });

  it('migrates a V1 schema to V7 without losing unknown fields', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: {
        version: 1,
        viewMode: 'pro',
        legacyUnknown: 'preserve-me',
      },
    });
    const service = createService(storage);

    await expect(service.getPerpsViewMode()).resolves.toBe('pro');
    await service.setPerpsViewMode('simple');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 7,
      viewMode: 'simple',
      activeInfoTab: 'account',
      skipLimitCloseDoubleConfirmation: false,
      ...defaultTradePreferences,
      legacyUnknown: 'preserve-me',
    });
  });

  it('repairs an invalid schema to V7 only when the user writes a mode', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: {
        version: 0,
        viewMode: 'simple',
        invalidField: true,
      },
    });
    const service = createService(storage);

    await service.setPerpsViewMode('pro');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 7,
      viewMode: 'pro',
      activeInfoTab: 'account',
      skipLimitCloseDoubleConfirmation: false,
      ...defaultTradePreferences,
    });
  });

  it('removes the legacy V2 book precision map without losing other fields', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: {
        version: 2,
        viewMode: 'pro',
        bookPrecisionByMarket: {
          'hyperliquid::BTC': { nSigFigs: 5, mantissa: null },
        },
        legacyUnknown: { preserve: true },
      },
    });
    const service = createService(storage);

    await expect(service.getPerpsViewMode()).resolves.toBe('pro');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 7,
      viewMode: 'pro',
      activeInfoTab: 'account',
      skipLimitCloseDoubleConfirmation: false,
      ...defaultTradePreferences,
      legacyUnknown: { preserve: true },
    });
  });

  it('round-trips the active info tab', async () => {
    const { readPerpsStore, storage } = createMemoryStorage();
    const service = createService(storage);

    await service.setPerpsProInfoTab('openOrders');

    await expect(service.getPerpsProInfoTab()).resolves.toBe('openOrders');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 7,
      viewMode: 'simple',
      activeInfoTab: 'openOrders',
      skipLimitCloseDoubleConfirmation: false,
      ...defaultTradePreferences,
    });
  });

  it('normalizes an invalid V3 tab during the V7 migration', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: {
        version: 3,
        viewMode: 'pro',
        activeInfoTab: 'history',
        unknown: true,
      } as unknown as PerpsProPreferences,
    });
    const service = createService(storage);

    await expect(service.getPerpsProInfoTab()).resolves.toBe('account');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 7,
      viewMode: 'pro',
      activeInfoTab: 'account',
      skipLimitCloseDoubleConfirmation: false,
      ...defaultTradePreferences,
      unknown: true,
    });
  });

  it('round-trips the device-level Limit close confirmation preference', async () => {
    const { readPerpsStore, storage } = createMemoryStorage();
    const service = createService(storage);

    await service.setSkipPerpsProLimitCloseConfirmation(true);
    await expect(service.getSkipPerpsProLimitCloseConfirmation()).resolves.toBe(
      true,
    );
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 7,
      viewMode: 'simple',
      activeInfoTab: 'account',
      skipLimitCloseDoubleConfirmation: true,
      ...defaultTradePreferences,
    });
  });

  it('round-trips the independent Position TP/SL confirmation preference', async () => {
    const { readPerpsStore, storage } = createMemoryStorage();
    const service = createService(storage);

    await service.setSkipPerpsProPositionTpSlConfirmation(true);
    await expect(
      service.getSkipPerpsProPositionTpSlConfirmation(),
    ).resolves.toBe(true);
    await expect(service.getSkipPerpsProLimitCloseConfirmation()).resolves.toBe(
      false,
    );
    await expect(
      service.getSkipPerpsProTradeConfirmation('market'),
    ).resolves.toBe(false);
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 7,
      viewMode: 'simple',
      activeInfoTab: 'account',
      skipLimitCloseDoubleConfirmation: false,
      ...defaultTradePreferences,
      skipPositionTpSlDoubleConfirmation: true,
    });
  });

  it('keeps the mode preference when resetStore clears account state', async () => {
    const { storage } = createMemoryStorage();
    const service = createService(storage);

    await service.setPerpsViewMode('pro');
    await service.setPerpsProInfoTab('positions');
    await service.setSkipPerpsProLimitCloseConfirmation(true);
    await service.resetStore();

    await expect(service.getPerpsViewMode()).resolves.toBe('pro');
    await expect(service.getPerpsProInfoTab()).resolves.toBe('positions');
    await expect(service.getSkipPerpsProLimitCloseConfirmation()).resolves.toBe(
      true,
    );
  });
});
