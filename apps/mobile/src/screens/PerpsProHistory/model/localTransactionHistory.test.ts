import type { PerpsFundingJournalEntry } from '@/core/services/perpsService';
import type { AccountHistoryItem } from '@/hooks/perps/usePerpsStore';

import type { PerpsProTransactionHistoryRow } from '../types';
import { mergePerpsProLocalTransactionHistory } from './localTransactionHistory';

const journalEntry = (
  overrides: Partial<PerpsFundingJournalEntry> = {},
): PerpsFundingJournalEntry => ({
  accountAddress: '0xabc',
  accountType: 'PrivateKey',
  amount: '25',
  asset: 'USDT',
  createdAt: 200,
  direction: 'deposit',
  localType: 'receive',
  operationId: 'operation-1',
  settlementAmount: '24.9',
  sourceIdentity: {
    hash: '0xsource',
    kind: 'evmTransactionHash',
  },
  status: 'pending',
  updatedAt: 200,
  version: 2,
  ...overrides,
});

const localItem = (
  overrides: Partial<AccountHistoryItem> = {},
): AccountHistoryItem => ({
  amount: '25',
  asset: 'USDT',
  assetAmountSource: 'local',
  hash: '0xsource',
  operationId: 'operation-1',
  settlementAmount: '24.9',
  status: 'pending',
  time: 200,
  type: 'receive',
  usdValue: '24.9',
  ...overrides,
});

const remoteRow = (
  overrides: Partial<PerpsProTransactionHistoryRow> = {},
): PerpsProTransactionHistoryRow => ({
  amount: '24.9',
  asset: 'USDC',
  assetAmountSource: 'legacyUsdc',
  direction: 'deposit',
  hash: '0xsource',
  key: 'remote-1',
  kind: 'transaction',
  rawType: 'deposit',
  status: 'success',
  time: 300,
  ...overrides,
});

describe('Perps Pro local transaction history', () => {
  it('shows pending and failed local operations with their real asset', () => {
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [journalEntry()],
      localHistory: [
        localItem(),
        localItem({
          amount: '3',
          asset: 'USDC',
          hash: '0xfailed',
          operationId: 'operation-2',
          status: 'failed',
          time: 100,
          type: 'withdraw',
        }),
      ],
      remoteRows: [],
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ asset: 'USDT', status: 'pending' }),
      expect.objectContaining({
        asset: 'USDC',
        direction: 'withdraw',
        status: 'failed',
      }),
    ]);
  });

  it('binds only an exact hash/direction and enriches legacy USDC ledger rows', () => {
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [journalEntry()],
      localHistory: [localItem()],
      remoteRows: [remoteRow()],
    });

    expect(result.confirmedOperationIds).toEqual(['operation-1']);
    expect(result.rows).toEqual([
      expect.objectContaining({
        amount: '25',
        asset: 'USDT',
        key: 'remote-1',
        status: 'success',
      }),
    ]);
  });

  it('does not guess a binding from time or amount', () => {
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [journalEntry()],
      localHistory: [localItem()],
      remoteRows: [remoteRow({ hash: '0xdifferent' })],
    });

    expect(result.confirmedOperationIds).toEqual([]);
    expect(result.rows.map(row => [row.asset, row.status])).toEqual([
      ['USDC', 'success'],
      ['USDT', 'pending'],
    ]);
  });

  it('removes a provider receive after an unmatched same-type ledger result', () => {
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [journalEntry({ fundingRoute: 'provider' })],
      localHistory: [localItem({ fundingRoute: 'provider' })],
      remoteRows: [
        remoteRow({
          amount: '5.974031',
          assetAmountSource: 'explicit',
          hash: '0xprovider-ledger',
          rawType: 'send',
          time: 300,
        }),
      ],
    });

    expect(result.confirmedOperationIds).toEqual(['operation-1']);
    expect(result.confirmations).toEqual([
      {
        operationId: 'operation-1',
        providerSettlementIdentity: {
          hash: '0xprovider-ledger',
          kind: 'hyperliquidLedgerHash',
        },
      },
    ]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        amount: '25',
        asset: 'USDT',
        hash: '0xprovider-ledger',
        status: 'success',
      }),
    ]);
  });

  it('keeps confirmed provider metadata bound to its persisted ledger hash', () => {
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [
        journalEntry({
          fundingRoute: 'provider',
          providerSettlementIdentity: {
            hash: '0xprovider-ledger',
            kind: 'hyperliquidLedgerHash',
          },
          status: 'confirmed',
        }),
      ],
      localHistory: [],
      remoteRows: [
        remoteRow({
          amount: '5.974031',
          assetAmountSource: 'explicit',
          hash: '0xprovider-ledger',
          rawType: 'send',
          time: 300,
        }),
      ],
    });

    expect(result.confirmations).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        amount: '25',
        asset: 'USDT',
        status: 'success',
      }),
    ]);
  });

  it('keeps confirmed direct metadata available after pending cleanup', () => {
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [
        journalEntry({
          fundingRoute: 'direct',
          localType: 'deposit',
          status: 'confirmed',
        }),
      ],
      localHistory: [],
      remoteRows: [remoteRow()],
    });

    expect(result.confirmations).toEqual([]);
    expect(result.rows[0]).toMatchObject({ asset: 'USDT', status: 'success' });
  });

  it('preserves an explicit official asset and amount for a direct deposit', () => {
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [
        journalEntry({ fundingRoute: 'direct', localType: 'deposit' }),
      ],
      localHistory: [localItem({ fundingRoute: 'direct', type: 'deposit' })],
      remoteRows: [
        remoteRow({
          amount: '24.75',
          asset: 'USDE',
          assetAmountSource: 'explicit',
        }),
      ],
    });

    expect(result.rows[0]).toMatchObject({ amount: '24.75', asset: 'USDE' });
  });

  it('preserves an unmatched explicit official settlement', () => {
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [],
      localHistory: [],
      remoteRows: [
        remoteRow({
          amount: '5.974031',
          asset: 'USDC',
          assetAmountSource: 'explicit',
          hash: '0xprovider-ledger',
          rawType: 'send',
        }),
      ],
    });

    expect(result.rows[0]).toMatchObject({
      amount: '5.974031',
      asset: 'USDC',
      assetAmountSource: 'explicit',
    });
  });

  it('binds a standard withdraw only by the prepared Hyperliquid nonce', () => {
    const withdrawEntry = journalEntry({
      asset: 'USDC',
      direction: 'withdraw',
      localType: 'withdraw',
      operationId: 'withdraw-operation',
      settlementIdentity: { kind: 'hyperliquidNonce', nonce: 42 },
      sourceIdentity: undefined,
    });
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [withdrawEntry],
      localHistory: [
        localItem({
          asset: 'USDC',
          hash: 'hl-nonce:42',
          operationId: 'withdraw-operation',
          settlementNonce: 42,
          type: 'withdraw',
        }),
      ],
      remoteRows: [
        remoteRow({
          direction: 'withdraw',
          hash: '0xledger',
          settlementNonce: 42,
        }),
      ],
    });

    expect(result.confirmedOperationIds).toEqual(['withdraw-operation']);
    expect(result.rows).toEqual([
      expect.objectContaining({
        direction: 'withdraw',
        hash: '0xledger',
        status: 'success',
      }),
    ]);
  });

  it('binds a HyperEVM sendAsset withdraw by its runtime ledger nonce', () => {
    const nonce = 1786604975615;
    const withdrawEntry = journalEntry({
      amount: '4.942581',
      asset: 'USDE',
      direction: 'withdraw',
      localType: 'withdraw',
      operationId: 'hyperevm-withdraw-operation',
      settlementAmount: '4.942581',
      settlementIdentity: { kind: 'hyperliquidNonce', nonce },
      sourceIdentity: undefined,
    });
    const result = mergePerpsProLocalTransactionHistory({
      journalEntries: [withdrawEntry],
      localHistory: [
        localItem({
          amount: '4.942581',
          asset: 'USDE',
          hash: `hl-nonce:${nonce}`,
          operationId: 'hyperevm-withdraw-operation',
          settlementNonce: nonce,
          type: 'withdraw',
        }),
      ],
      remoteRows: [
        remoteRow({
          amount: '4.941592',
          asset: 'USDE',
          direction: 'withdraw',
          hash: '0xledger',
          rawType: 'send',
          settlementNonce: nonce,
        }),
      ],
    });

    expect(result.confirmedOperationIds).toEqual([
      'hyperevm-withdraw-operation',
    ]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        amount: '4.942581',
        asset: 'USDE',
        hash: '0xledger',
        status: 'success',
      }),
    ]);
  });
});
