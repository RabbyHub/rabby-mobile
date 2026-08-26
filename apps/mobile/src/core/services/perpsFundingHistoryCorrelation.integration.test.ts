import type { StorageAdapater } from '@rabby-wallet/persist-store';

import type { Account } from '@/core/startupServices/preference';
import { createPerpsFundingOperation } from '@/hooks/perps/funding/fundingHistory';
import { applyPerpsFundingConfirmationToJournalEntry } from '@/hooks/perps/funding/fundingJournal';
import { mergePerpsProLocalTransactionHistory } from '@/screens/PerpsProHistory/model/localTransactionHistory';
import { mapPerpsProTransactionHistoryFact } from '@/screens/PerpsProHistory/model/transactionHistory';
import type { PerpsProLedgerFact } from '@/screens/PerpsProHistory/types';

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
  address: '0x341a1fBD51825E5a107DB54cCb3166DeBA145479',
  type: 'SimpleKeyring',
} as Account;

const providerSettlementFact: PerpsProLedgerFact = {
  time: 1786895704121,
  hash: '0xa435b8fad560ffcea5af04424db9f702018b00e070641ea047fe644d9464d9b9',
  delta: {
    type: 'send',
    user: '0xf70da97812cb96acdf810712aa562db8dfa3dbef',
    destination: account.address.toLowerCase(),
    sourceDex: '',
    destinationDex: '',
    token: 'USDC',
    amount: '5.974031',
    usdcValue: '5.974031',
    fee: '0.0',
    nativeTokenFee: '0.0',
    nonce: 1786895703456,
    feeToken: '',
  },
};

describe('Perps Pro funding history correlation integration', () => {
  it('keeps provider USDT metadata after confirmation and service recreation', () => {
    const providerSuccess = mapPerpsProTransactionHistoryFact(
      providerSettlementFact,
      account.address,
    ).row;
    expect(providerSuccess).toMatchObject({
      amount: '5.974031',
      asset: 'USDC',
      assetAmountSource: 'explicit',
      direction: 'deposit',
      rawType: 'send',
    });
    expect(providerSuccess).not.toBeNull();
    const storage = createMemoryStorage();
    const service = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    const operation = createPerpsFundingOperation({
      account,
      fundingRoute: 'provider',
      history: {
        amount: '6',
        asset: 'USDT',
        settlementAmount: '5.974031',
        sourceChainId: 'eth',
        sourceTokenId: '0xusdt',
      },
      identity: { sourceHash: '0xsource' },
      localType: 'receive',
      time: 1786895703000,
    });
    expect(operation).not.toBeNull();
    service.upsertPerpsFundingJournalEntry(operation!.journalEntry);

    const settled = mergePerpsProLocalTransactionHistory({
      journalEntries: service.getPerpsFundingJournal(),
      localHistory: [operation!.historyItem],
      remoteRows: [providerSuccess!],
    });
    expect(settled.rows[0]).toMatchObject({
      amount: '6',
      asset: 'USDT',
      status: 'success',
    });
    expect(settled.confirmations).toHaveLength(1);

    service.upsertPerpsFundingJournalEntry(
      applyPerpsFundingConfirmationToJournalEntry(
        service.getPerpsFundingJournal()[0],
        settled.confirmations[0],
        1786895705000,
      ),
    );
    const recreated = new PerpsService({
      keyringCrypto,
      storageAdapter: storage,
    });
    const afterRestart = mergePerpsProLocalTransactionHistory({
      journalEntries: recreated.getPerpsFundingJournal(),
      localHistory: [],
      remoteRows: [providerSuccess!],
    });

    expect(afterRestart.confirmations).toEqual([]);
    expect(afterRestart.rows).toEqual([
      expect.objectContaining({
        amount: '6',
        asset: 'USDT',
        hash: '0xa435b8fad560ffcea5af04424db9f702018b00e070641ea047fe644d9464d9b9',
        status: 'success',
      }),
    ]);
  });
});
