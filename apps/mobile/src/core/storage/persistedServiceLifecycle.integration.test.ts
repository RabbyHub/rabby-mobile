import type { StorageAdapater } from '@rabby-wallet/persist-store';

// These integration tests intentionally construct the real business services.
/* eslint-disable no-runtime-service-imports */
import { PreferenceService } from '@/core/startupServices/preference';
import { RabbyPointsService } from '@/core/services/rabbyPoints';
import { WhitelistService } from '@/core/services/whitelist';
/* eslint-enable no-runtime-service-imports */

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    logScreenView: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(async () => undefined),
  }),
}));

function createSerializedMemoryStorage() {
  const values = new Map<string, string>();
  const writes: string[] = [];

  const storage: StorageAdapater = {
    getItem: key => {
      const value = values.get(String(key));
      return value === undefined ? null : JSON.parse(value);
    },
    setItem: (key, value) => {
      writes.push(String(key));
      values.set(String(key), JSON.stringify(value));
    },
    removeItem: key => {
      values.delete(String(key));
    },
    clearAll: () => {
      values.clear();
    },
  };

  return {
    storage,
    getWriteCount: () => writes.length,
    seed: (key: string, value: unknown) => {
      values.set(key, JSON.stringify(value));
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('persisted business service lifecycle integration', () => {
  it('persists the half-hidden migration and preserves a later choice to show balances', async () => {
    const { storage, seed } = createSerializedMemoryStorage();
    seed('preference', { balanceHideType: 'HALF_HIDE' });

    const firstService = new PreferenceService({ storageAdapter: storage });
    expect(firstService.getPreference('balanceHideType')).toBe('HIDE');
    await flushMicrotasks();
    expect(storage.getItem('preference').balanceHideType).toBe('HIDE');

    const reconstructedService = new PreferenceService({
      storageAdapter: storage,
    });
    expect(reconstructedService.getPreference('balanceHideType')).toBe('HIDE');
    reconstructedService.setPreference({ balanceHideType: 'SHOW' });
    await flushMicrotasks();

    const thirdService = new PreferenceService({ storageAdapter: storage });
    expect(thirdService.getPreference('balanceHideType')).toBe('SHOW');
  });

  it.each(['SHOW', 'HIDE', undefined] as const)(
    'preserves an existing %s balance preference or the default',
    async balanceHideType => {
      const { storage, seed } = createSerializedMemoryStorage();
      seed('preference', balanceHideType ? { balanceHideType } : {});

      const service = new PreferenceService({ storageAdapter: storage });
      expect(service.getPreference('balanceHideType')).toBe(
        balanceHideType ?? 'SHOW',
      );
      await flushMicrotasks();
    },
  );

  it('coalesces writes and reconstructs a new service from persisted state', async () => {
    const { storage, getWriteCount } = createSerializedMemoryStorage();
    const firstService = new RabbyPointsService({
      storageAdapter: storage,
    });
    const changes: string[][] = [];
    const unsubscribe = firstService.subscribeStore(change => {
      changes.push([...change.changedKeys]);
    });

    expect(getWriteCount()).toBe(1);

    firstService.setSignature('0xAbC', 'signature-a');
    firstService.setSignature('0xDef', 'signature-b');

    expect(firstService.getSignature('0xabc')).toBe('signature-a');
    expect(firstService.getSignature('0xDEF')).toBe('signature-b');
    expect(changes).toEqual([['signatures'], ['signatures']]);
    expect(getWriteCount()).toBe(1);

    await flushMicrotasks();
    expect(getWriteCount()).toBe(2);

    const reconstructedService = new RabbyPointsService({
      storageAdapter: storage,
    });

    expect(reconstructedService.getStoreSnapshot()).toEqual({
      signatures: {
        '0xabc': 'signature-a',
        '0xdef': 'signature-b',
      },
    });

    reconstructedService.clearSignatureByAddr('0xabc');
    reconstructedService.persistStoreImmediately();

    const thirdService = new RabbyPointsService({
      storageAdapter: storage,
    });
    expect(thirdService.getStoreSnapshot()).toEqual({
      signatures: {
        '0xdef': 'signature-b',
      },
    });

    unsubscribe();
  });

  it('normalizes legacy whitelist state and preserves the migrated records after reconstruction', async () => {
    const { storage, getWriteCount, seed } = createSerializedMemoryStorage();
    const firstAddress = '0xAaaA000000000000000000000000000000000001';
    const secondAddress = '0xBbbB000000000000000000000000000000000002';
    const thirdAddress = '0xCccC000000000000000000000000000000000003';

    seed('whitelist', {
      enabled: false,
      whitelists: [
        firstAddress,
        { address: firstAddress.toLowerCase(), addedAt: 1 },
        { address: secondAddress, addedAt: 2 },
      ],
    });

    const firstService = new WhitelistService({ storageAdapter: storage });
    expect(firstService.isWhitelistEnabled()).toBe(true);
    expect(firstService.getWhitelistRecords()).toEqual([
      { address: firstAddress.toLowerCase() },
      { address: secondAddress.toLowerCase(), addedAt: 2 },
    ]);

    await flushMicrotasks();
    const writesAfterMigration = getWriteCount();

    firstService.addWhitelist(thirdAddress);
    firstService.updateWhitelistOrder([
      thirdAddress,
      secondAddress,
      firstAddress,
    ]);
    await flushMicrotasks();

    expect(getWriteCount()).toBe(writesAfterMigration + 1);

    const reconstructedService = new WhitelistService({
      storageAdapter: storage,
    });
    expect(reconstructedService.isWhitelistEnabled()).toBe(true);
    expect(reconstructedService.getWhitelistRecords()).toEqual([
      expect.objectContaining({ address: thirdAddress.toLowerCase() }),
      { address: secondAddress.toLowerCase(), addedAt: 2 },
      { address: firstAddress.toLowerCase() },
    ]);
  });
});
