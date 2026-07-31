import type { StorageAdapater } from '@rabby-wallet/persist-store';

import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

import {
  PerpsService,
  type PerpsBookPrecision,
  type PerpsProPreferences,
  type PerpsServiceStore,
} from './perpsService';

const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

const createMemoryStorage = (
  initialPerpsStore?: Partial<PerpsServiceStore>,
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
      version: 3,
      viewMode: 'pro',
      futureFlag: 'preserve-me',
    } satisfies PerpsProPreferences;
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: futurePreferences,
    });
    const service = createService(storage);

    await expect(service.getPerpsViewMode()).resolves.toBe('pro');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual(futurePreferences);
  });

  it('preserves future schema fields when writing a new mode', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: {
        version: 4,
        viewMode: 'simple',
        futureFlag: { enabled: true },
      },
    });
    const service = createService(storage);

    await service.setPerpsViewMode('pro');
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 4,
      viewMode: 'pro',
      futureFlag: { enabled: true },
    });
  });

  it('migrates a V1 schema to V2 without losing unknown fields on write', async () => {
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
      version: 2,
      viewMode: 'simple',
      legacyUnknown: 'preserve-me',
    });
  });

  it('repairs an invalid schema to V2 only when the user writes a mode', async () => {
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
      version: 2,
      viewMode: 'pro',
      bookPrecisionByMarket: {},
    });
  });

  it('persists precision independently for each market', async () => {
    const { storage } = createMemoryStorage();
    const firstService = createService(storage);
    const btcPrecision: PerpsBookPrecision = {
      nSigFigs: 5,
      mantissa: 2,
    };
    const xyzPrecision: PerpsBookPrecision = {
      nSigFigs: 3,
      mantissa: null,
    };

    await firstService.setPerpsBookPrecision('hyperliquid::BTC', btcPrecision);
    await firstService.setPerpsBookPrecision('xyz::xyz:AAPL', xyzPrecision);
    jest.advanceTimersByTime(1000);

    const rehydratedService = createService(storage);
    await expect(
      rehydratedService.getPerpsBookPrecision('hyperliquid::BTC'),
    ).resolves.toEqual(btcPrecision);
    await expect(
      rehydratedService.getPerpsBookPrecision('xyz::xyz:AAPL'),
    ).resolves.toEqual(xyzPrecision);
    await expect(
      rehydratedService.getPerpsBookPrecision('hyperliquid::ETH'),
    ).resolves.toBeNull();
  });

  it.each([
    { nSigFigs: 1, mantissa: null },
    { nSigFigs: 4, mantissa: 2 },
    { nSigFigs: 5, mantissa: 1 },
    { nSigFigs: 5 },
  ])('rejects invalid precision %#', async precision => {
    const { storage } = createMemoryStorage();
    const service = createService(storage);

    await expect(
      service.setPerpsBookPrecision(
        'hyperliquid::BTC',
        precision as PerpsBookPrecision,
      ),
    ).rejects.toThrow('Invalid Perps book precision');
  });

  it('preserves future fields and version when writing precision', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: {
        version: 7,
        viewMode: 'pro',
        bookPrecisionByMarket: {
          'hyperliquid::BTC': { nSigFigs: 5, mantissa: null },
        },
        futureFlag: { enabled: true },
      },
    });
    const service = createService(storage);

    await service.setPerpsBookPrecision('xyz::xyz:AAPL', {
      nSigFigs: 4,
      mantissa: null,
    });
    jest.advanceTimersByTime(1000);

    expect(readPerpsStore()?.proPreferences).toEqual({
      version: 7,
      viewMode: 'pro',
      bookPrecisionByMarket: {
        'hyperliquid::BTC': { nSigFigs: 5, mantissa: null },
        'xyz::xyz:AAPL': { nSigFigs: 4, mantissa: null },
      },
      futureFlag: { enabled: true },
    });
  });

  it('ignores malformed persisted precision without rewriting it on read', async () => {
    const { readPerpsStore, storage } = createMemoryStorage({
      proPreferences: {
        version: 2,
        viewMode: 'pro',
        bookPrecisionByMarket: {
          'hyperliquid::BTC': { nSigFigs: 4, mantissa: 2 },
        },
      },
    });
    const service = createService(storage);

    await expect(
      service.getPerpsBookPrecision('hyperliquid::BTC'),
    ).resolves.toBeNull();
    jest.advanceTimersByTime(1000);
    expect(readPerpsStore()?.proPreferences.bookPrecisionByMarket).toEqual({
      'hyperliquid::BTC': { nSigFigs: 4, mantissa: 2 },
    });
  });

  it('keeps the mode preference when resetStore clears account state', async () => {
    const { storage } = createMemoryStorage();
    const service = createService(storage);

    await service.setPerpsViewMode('pro');
    await service.resetStore();

    await expect(service.getPerpsViewMode()).resolves.toBe('pro');
  });
});
