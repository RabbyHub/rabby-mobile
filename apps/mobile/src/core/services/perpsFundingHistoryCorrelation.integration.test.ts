import type { StorageAdapater } from '@rabby-wallet/persist-store';

import type { Account } from '@/core/startupServices/preference';
import { createPerpsFundingOperation } from '@/hooks/perps/funding/fundingHistory';
import { applyPerpsFundingConfirmationToJournalEntry } from '@/hooks/perps/funding/fundingJournal';
import { mergePerpsProLocalTransactionHistory } from '@/screens/PerpsProHistory/model/localTransactionHistory';
import type { PerpsProTransactionHistoryRow } from '@/screens/PerpsProHistory/types';

import { PerpsService } from './perpsService';

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
  return storage;
};

const keyringCrypto = {
  decryptWithPassword: jest.fn(async () => ({})),
  encryptWithPassword: jest.fn(async (value: unknown) => JSON.stringify(value)),
  isUnlocked: jest.fn(() => true),
};

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'SimpleKeyring',
} as Account;

const providerSuccess: PerpsProTransactionHistoryRow = {
  amount: '24.9',
  asset: 'USDC',
  assetAmountSource: 'legacyUsdc',
  direction: 'deposit',
  hash: '0xprovider-ledger',
  key: 'remote:provider-ledger',
  kind: 'transaction',
  rawType: 'send',
  status: 'success',
  time: 200,
};

describe('Perps Pro funding history correlation integration', () => {
  it('keeps provider USDT metadata after confirmation and service recreation', () => {
    const storage = createMemoryStorage();
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    const operation = createPerpsFundingOperation({
      account,
      fundingRoute: 'provider',
      history: {
        amount: '25',
        asset: 'USDT',
        settlementAmount: '24.9',
        sourceChainId: 'eth',
        sourceTokenId: '0xusdt',
      },
      identity: { sourceHash: '0xsource' },
      localType: 'receive',
      time: 100,
    });
    expect(operation).not.toBeNull();
    service.upsertPerpsFundingJournalEntry(operation!.journalEntry);

    const settled = mergePerpsProLocalTransactionHistory({
      journalEntries: service.getPerpsFundingJournal(),
      localHistory: [operation!.historyItem],
      remoteRows: [providerSuccess],
    });
    expect(settled.rows[0]).toMatchObject({
      amount: '25',
      asset: 'USDT',
      status: 'success',
    });
    expect(settled.confirmations).toHaveLength(1);

    service.upsertPerpsFundingJournalEntry(
      applyPerpsFundingConfirmationToJournalEntry(
        service.getPerpsFundingJournal()[0],
        settled.confirmations[0],
        300,
      ),
    );
    const recreated = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    const afterRestart = mergePerpsProLocalTransactionHistory({
      journalEntries: recreated.getPerpsFundingJournal(),
      localHistory: [],
      remoteRows: [providerSuccess],
    });

    expect(afterRestart.confirmations).toEqual([]);
    expect(afterRestart.rows).toEqual([
      expect.objectContaining({
        amount: '25',
        asset: 'USDT',
        hash: '0xprovider-ledger',
        status: 'success',
      }),
    ]);
  });
});
