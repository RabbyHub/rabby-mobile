import type { AccountHistoryItem } from './types';
import { reconcilePerpsFundingHistory } from './fundingHistoryReconciliation';

const item = (
  overrides: Partial<AccountHistoryItem> = {},
): AccountHistoryItem => ({
  amount: '10',
  asset: 'USDC',
  assetAmountSource: 'local',
  hash: '0xsource',
  operationId: 'operation-1',
  status: 'pending',
  time: 100,
  type: 'deposit',
  usdValue: '10',
  ...overrides,
});

const providerPending = (
  overrides: Partial<AccountHistoryItem> = {},
): AccountHistoryItem =>
  item({
    amount: '25',
    asset: 'USDT',
    fundingRoute: 'provider',
    settlementAmount: '24.9',
    type: 'receive',
    usdValue: '24.9',
    ...overrides,
  });

const providerSuccess = (
  overrides: Partial<AccountHistoryItem> = {},
): AccountHistoryItem =>
  item({
    amount: '5.974031',
    asset: 'USDC',
    assetAmountSource: 'explicit',
    hash: '0xa435b8fad560ffcea5af04424db9f702018b00e070641ea047fe644d9464d9b9',
    operationId: undefined,
    status: 'success',
    time: 1786895704121,
    type: 'receive',
    usdValue: '5.974031',
    ...overrides,
  });

describe('funding history reconciliation', () => {
  it('uses an exact direct-deposit hash before provider correlation', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [
        item(),
        providerPending({
          hash: '0xsecond',
          operationId: 'operation-2',
          time: 90,
        }),
      ],
      observation: 'baseline',
      remoteHistory: [
        item({
          amount: '9.99',
          asset: 'USDC',
          assetAmountSource: 'legacyUsdc',
          operationId: undefined,
          status: 'success',
          time: 200,
        }),
      ],
    });

    expect(result.confirmedOperationIds).toEqual(['operation-1']);
    expect(result.local.map(local => local.operationId)).toEqual([
      'operation-2',
    ]);
    expect(result.history[0]).toMatchObject({
      amount: '10',
      operationId: 'operation-1',
      sourceHash: undefined,
    });
  });

  it('persists and enriches one provider pending with one newer success', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [providerPending()],
      observation: 'incremental',
      remoteHistory: [providerSuccess()],
    });

    expect(result.confirmations).toEqual([
      {
        operationId: 'operation-1',
        providerSettlementIdentity: {
          hash: '0xa435b8fad560ffcea5af04424db9f702018b00e070641ea047fe644d9464d9b9',
          kind: 'hyperliquidLedgerHash',
        },
      },
    ]);
    expect(result.local).toEqual([]);
    expect(result.history[0]).toMatchObject({
      amount: '25',
      asset: 'USDT',
      operationId: 'operation-1',
    });
  });

  it('deduplicates journal and memory copies of the same provider operation', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [providerPending(), providerPending()],
      observation: 'baseline',
      remoteHistory: [providerSuccess()],
    });

    expect(result.confirmedOperationIds).toEqual(['operation-1']);
    expect(result.local).toEqual([]);
  });

  it('keeps all pending when two provider operations share one success', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [
        providerPending(),
        providerPending({
          hash: '0xsecond',
          operationId: 'operation-2',
        }),
      ],
      observation: 'incremental',
      remoteHistory: [providerSuccess()],
    });

    expect(result.confirmations).toEqual([]);
    expect(result.local).toHaveLength(2);
  });

  // Previously this demanded a single eligible row and gave up otherwise, so
  // any unrelated transfer landing in the same window pinned the operation as
  // pending forever. With one outstanding operation the earliest credit at or
  // after it started is its settlement.
  it('correlates the earliest eligible success when several are newer', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [providerPending()],
      observation: 'baseline',
      remoteHistory: [
        providerSuccess(),
        providerSuccess({ hash: '0xsecond-ledger', time: 201 }),
      ],
    });

    expect(result.confirmations).toEqual([
      {
        operationId: 'operation-1',
        providerSettlementIdentity: {
          hash: '0xsecond-ledger',
          kind: 'hyperliquidLedgerHash',
        },
      },
    ]);
    expect(result.local).toEqual([]);
  });

  it.each([
    ['older success', providerSuccess({ time: 99 })],
    ['zero hash', providerSuccess({ hash: `0x${'0'.repeat(64)}` })],
    ['wrong type', providerSuccess({ type: 'deposit' })],
  ])('does not correlate a provider operation with %s', (_name, remote) => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [providerPending()],
      observation: 'baseline',
      remoteHistory: [remote],
    });

    expect(result.confirmations).toEqual([]);
    expect(result.local).toHaveLength(1);
  });

  // A HyperEVM deposit is credited by the deposit contract, so its ledger row
  // carries Hyperliquid's action hash while the local record holds the
  // HyperEVM transaction hash — the two can never be equal. Correlation is the
  // only path, and gating it on the provider route (as this once did) left the
  // operation pending forever.
  it('correlates a direct HyperEVM receive that can never match on hash', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [providerPending({ fundingRoute: 'direct' })],
      observation: 'incremental',
      remoteHistory: [providerSuccess()],
    });

    expect(result.confirmedOperationIds).toEqual(['operation-1']);
    expect(result.local).toEqual([]);
  });

  it('does not correlate a direct deposit, whose ledger row echoes its hash', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [item({ fundingRoute: 'direct', type: 'deposit' })],
      observation: 'incremental',
      remoteHistory: [
        item({
          hash: '0xunrelated',
          operationId: undefined,
          status: 'success',
          time: 200,
          type: 'deposit',
        }),
      ],
    });

    expect(result.confirmations).toEqual([]);
    expect(result.local).toHaveLength(1);
  });

  it('conservatively recognizes a legacy provider route from source metadata', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [
        providerPending({
          fundingRoute: undefined,
          sourceChainId: 'eth',
          sourceTokenId: '0xusdt',
        }),
      ],
      observation: 'baseline',
      remoteHistory: [providerSuccess()],
    });

    expect(result.confirmedOperationIds).toEqual(['operation-1']);
  });

  describe('pending TTL', () => {
    const TTL_MS = 30 * 60 * 1000;

    it('drops an unmatched pending operation once it outlives the window', () => {
      const result = reconcilePerpsFundingHistory({
        localHistory: [providerPending()],
        now: 100 + TTL_MS + 1,
        observation: 'baseline',
        remoteHistory: [],
      });

      expect(result.local).toEqual([]);
    });

    it('keeps an unmatched pending operation inside the window', () => {
      const result = reconcilePerpsFundingHistory({
        localHistory: [providerPending()],
        now: 100 + TTL_MS,
        observation: 'baseline',
        remoteHistory: [],
      });

      expect(result.local).toHaveLength(1);
    });

    it('expires nothing when no clock is supplied', () => {
      const result = reconcilePerpsFundingHistory({
        localHistory: [providerPending()],
        observation: 'baseline',
        remoteHistory: [],
      });

      expect(result.local).toHaveLength(1);
    });

    it('leaves a settled operation resolved rather than expired', () => {
      const result = reconcilePerpsFundingHistory({
        localHistory: [providerPending()],
        now: 100 + TTL_MS + 1,
        observation: 'baseline',
        remoteHistory: [providerSuccess()],
      });

      expect(result.confirmedOperationIds).toEqual(['operation-1']);
      expect(result.local).toEqual([]);
    });

    it('never expires a failed operation the user still needs to see', () => {
      const result = reconcilePerpsFundingHistory({
        localHistory: [providerPending({ status: 'failed' })],
        now: 100 + TTL_MS + 1,
        observation: 'baseline',
        remoteHistory: [],
      });

      expect(result.local).toHaveLength(1);
    });
  });

  it('never turns a source-failed operation into success', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [providerPending({ status: 'failed' })],
      observation: 'incremental',
      remoteHistory: [providerSuccess()],
    });

    expect(result.confirmedOperationIds).toEqual([]);
    expect(result.local[0]?.status).toBe('failed');
  });

  it('prevents a success observed before local persistence from reappearing pending', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [providerPending()],
      observation: 'baseline',
      remoteHistory: [providerSuccess()],
    });

    expect(result.confirmedOperationIds).toEqual(['operation-1']);
    expect(result.local).toEqual([]);
  });

  it('uses confirmed exact metadata without confirming the operation again', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [
        item({
          amount: '25',
          asset: 'USDT',
          assetAmountSource: 'local',
          status: 'success',
        }),
      ],
      observation: 'baseline',
      remoteHistory: [
        item({
          amount: '24.9',
          asset: 'USDC',
          assetAmountSource: 'legacyUsdc',
          operationId: undefined,
          status: 'success',
          time: 200,
        }),
      ],
    });

    expect(result.confirmations).toEqual([]);
    expect(result.history[0]).toMatchObject({ amount: '25', asset: 'USDT' });
  });

  it('uses provider source asset and amount over its explicit USDC settlement', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [
        providerPending({
          amount: '6',
          settlementAmount: '5.974031',
          time: 1786895703000,
          usdValue: '5.974031',
        }),
      ],
      observation: 'baseline',
      remoteHistory: [providerSuccess()],
    });

    expect(result.confirmedOperationIds).toEqual(['operation-1']);
    expect(result.history[0]).toMatchObject({
      amount: '6',
      asset: 'USDT',
      assetAmountSource: 'local',
    });
  });

  it('preserves an explicit official asset and amount for direct funding', () => {
    const result = reconcilePerpsFundingHistory({
      localHistory: [
        item({ amount: '10', asset: 'USDT', fundingRoute: 'direct' }),
      ],
      observation: 'baseline',
      remoteHistory: [
        item({
          amount: '9.5',
          asset: 'USDE',
          assetAmountSource: 'explicit',
          operationId: undefined,
          status: 'success',
          time: 200,
        }),
      ],
    });

    expect(result.history[0]).toMatchObject({ amount: '9.5', asset: 'USDE' });
  });
});
