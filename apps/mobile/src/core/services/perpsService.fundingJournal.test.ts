import type { StorageAdapater } from '@rabby-wallet/persist-store';

import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

import { PerpsService, type PerpsFundingJournalEntry } from './perpsService';

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
  overrides: Partial<PerpsFundingJournalEntry> = {},
): PerpsFundingJournalEntry => ({
  accountAddress: '0xabc',
  accountType: 'PrivateKey',
  amount: '12',
  asset: 'USDT',
  createdAt: 1,
  direction: 'deposit',
  fundingRoute: 'provider',
  localType: 'receive',
  operationId: 'operation-1',
  settlementAmount: '11.9',
  sourceChainId: 'eth',
  sourceIdentity: {
    hash: '0xhash',
    kind: 'evmTransactionHash',
  },
  sourceTokenId: '0xtoken',
  status: 'pending',
  updatedAt: 1,
  version: 2,
  ...overrides,
});

describe('PerpsService funding journal', () => {
  it('round-trips status changes across service recreation and resetStore', async () => {
    const { storage } = createMemoryStorage();
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    service.upsertPerpsFundingJournalEntry(entry());
    service.upsertPerpsFundingJournalEntry(
      entry({ status: 'failed', updatedAt: 2 }),
    );

    await service.resetStore();
    const recreated = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    expect(recreated.getPerpsFundingJournal()).toEqual([
      entry({ status: 'failed', updatedAt: 2 }),
    ]);
  });

  it('removes an entry and fails closed on malformed persisted data', () => {
    const { storage, values } = createMemoryStorage();
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    service.upsertPerpsFundingJournalEntry(entry());
    service.removePerpsFundingJournalEntry('operation-1');
    expect(values.has(APP_STORE_NAMES.perpsFundingJournal)).toBe(false);

    values.set(APP_STORE_NAMES.perpsFundingJournal, {
      entries: [{ operationId: 'missing-critical-fields' }],
      version: 2,
    });
    expect(() => service.getPerpsFundingJournal()).toThrow(
      'Perps funding journal is invalid',
    );
  });

  it('round-trips a confirmed provider settlement association', () => {
    const { storage } = createMemoryStorage();
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    service.upsertPerpsFundingJournalEntry(
      entry({
        providerSettlementIdentity: {
          hash: '0xledger',
          kind: 'hyperliquidLedgerHash',
        },
        status: 'confirmed',
        updatedAt: 2,
      }),
    );

    expect(service.getPerpsFundingJournal()).toEqual([
      expect.objectContaining({
        providerSettlementIdentity: {
          hash: '0xledger',
          kind: 'hyperliquidLedgerHash',
        },
        status: 'confirmed',
      }),
    ]);
  });

  it('reads valid version 1 source-hash entries through the version 2 model', () => {
    const { storage, values } = createMemoryStorage();
    values.set(APP_STORE_NAMES.perpsFundingJournal, {
      entries: [
        {
          accountAddress: '0xabc',
          accountType: 'PrivateKey',
          amount: '12',
          asset: 'USDT',
          createdAt: 1,
          direction: 'deposit',
          localType: 'receive',
          operationId: 'legacy-operation',
          settlementAmount: '11.9',
          sourceHash: '0xlegacy',
          status: 'pending',
          updatedAt: 1,
          version: 1,
        },
      ],
      version: 1,
    });
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });

    expect(service.getPerpsFundingJournal()).toEqual([
      expect.objectContaining({
        operationId: 'legacy-operation',
        sourceIdentity: {
          hash: '0xlegacy',
          kind: 'evmTransactionHash',
        },
        version: 2,
      }),
    ]);
  });
});
