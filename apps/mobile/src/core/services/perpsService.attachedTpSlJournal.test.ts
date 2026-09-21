import type { StorageAdapater } from '@rabby-wallet/persist-store';

import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

import {
  PerpsService,
  type PerpsAttachedTpSlJournalEntry,
} from './perpsService';

const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

const createMemoryStorage = () => {
  const values = new Map<string, unknown>();
  const storage: StorageAdapater = {
    clearAll: () => values.clear(),
    getItem: key => clone(values.get(String(key))),
    removeItem: key => {
      values.delete(String(key));
    },
    setItem: (key, value) => values.set(String(key), clone(value)),
  };
  return { storage, values };
};

const keyringCrypto = {
  decryptWithPassword: jest.fn(async () => ({})),
  encryptWithPassword: jest.fn(async (value: unknown) => JSON.stringify(value)),
  isUnlocked: jest.fn(() => true),
};

const entry = (
  overrides: Partial<PerpsAttachedTpSlJournalEntry> = {},
): PerpsAttachedTpSlJournalEntry => ({
  accountAddress: '0xabc',
  accountType: 'PrivateKey',
  cloids: {
    parent: '0x11111111111111111111111111111111',
    takeProfit: '0x22222222222222222222222222222222',
  },
  coin: 'BTC',
  commandId: 'command-1',
  createdAt: 1,
  dexId: '',
  legs: [],
  marketKey: 'BTC:USDC',
  outcome: 'prepared',
  parentFingerprint: 'parent-1',
  parentSide: 'buy',
  updatedAt: 1,
  version: 1,
  ...overrides,
});

describe('PerpsService attached TP/SL journal', () => {
  it('round-trips and replaces entries synchronously', () => {
    const { storage } = createMemoryStorage();
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });

    service.upsertPerpsAttachedTpSlJournalEntry(entry());
    service.upsertPerpsAttachedTpSlJournalEntry(
      entry({ outcome: 'unknown', updatedAt: 2 }),
    );

    expect(service.getPerpsAttachedTpSlJournal()).toEqual([
      entry({ outcome: 'unknown', updatedAt: 2 }),
    ]);
  });

  it('keeps unresolved entries across service recreation and resetStore', async () => {
    const { storage } = createMemoryStorage();
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    service.upsertPerpsAttachedTpSlJournalEntry(entry());

    await service.resetStore();

    const recreated = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    expect(recreated.getPerpsAttachedTpSlJournal()).toEqual([entry()]);
  });

  it('removes only the selected command and deletes an empty journal key', () => {
    const { storage, values } = createMemoryStorage();
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    service.upsertPerpsAttachedTpSlJournalEntry(entry());
    service.upsertPerpsAttachedTpSlJournalEntry(
      entry({ commandId: 'command-2', parentFingerprint: 'parent-2' }),
    );

    service.removePerpsAttachedTpSlJournalEntry('command-1');
    expect(service.getPerpsAttachedTpSlJournal()).toHaveLength(1);
    service.removePerpsAttachedTpSlJournalEntry('command-2');

    expect(values.has(APP_STORE_NAMES.perpsAttachedTpSlJournal)).toBe(false);
  });

  it('fails closed on a malformed persisted journal', () => {
    const { storage, values } = createMemoryStorage();
    values.set(APP_STORE_NAMES.perpsAttachedTpSlJournal, {
      entries: [{ commandId: 'missing-critical-fields' }],
      version: 1,
    });
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });

    expect(() => service.getPerpsAttachedTpSlJournal()).toThrow(
      'Attached TP/SL journal is invalid',
    );
  });
});
