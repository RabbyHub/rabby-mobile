import type { PerpsAttachedTpSlJournalEntry } from '@/core/services/perpsService';

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: jest.fn() },
}));

import {
  classifyPerpsProAttachedTpSlReconciliation,
  reconcilePerpsProAttachedTpSl,
} from './reconcileAttachedTpSl';

const entry = (): PerpsAttachedTpSlJournalEntry => ({
  accountAddress: '0xabc',
  accountType: 'PrivateKey',
  cloids: {
    parent: '0x11111111111111111111111111111111',
    stopLoss: '0x33333333333333333333333333333333',
    takeProfit: '0x22222222222222222222222222222222',
  },
  coin: 'BTC',
  commandId: 'command-1',
  createdAt: 1,
  dexId: '',
  legs: [],
  marketKey: 'BTC:USDC',
  outcome: 'unknown',
  parentFingerprint: 'parent-1',
  parentSide: 'buy',
  updatedAt: 1,
  version: 1,
});

const order = (cloid: string, oid: number, status = 'open') => ({
  order: {
    children: [],
    cloid,
    coin: 'BTC',
    isPositionTpsl: false,
    isTrigger: false,
    limitPx: '100',
    oid,
    orderType: 'Limit',
    origSz: '1',
    reduceOnly: false,
    side: 'B' as const,
    sz: '1',
    tif: 'Gtc',
    timestamp: 1,
    triggerCondition: '',
    triggerPx: '0',
  },
  status,
  statusTimestamp: 1,
});

const dependencies = () => ({
  getClearinghouse: jest.fn(async () => ({ assetPositions: [] } as any)),
  getFills: jest.fn(async () => []),
  getOpenOrders: jest.fn(async () => []),
  getOrderStatus: jest.fn(async (cloid: string) => ({
    order: order(cloid, Number(cloid.slice(2, 3)) || 1),
    status: 'order' as const,
  })),
  sleep: jest.fn(async () => undefined),
});

describe('attached TP/SL reconciliation', () => {
  it('classifies accepted, rejected and unresolved vectors conservatively', () => {
    expect(
      classifyPerpsProAttachedTpSlReconciliation([
        { cloid: entry().cloids.parent, kind: 'accepted', role: 'parent' },
        {
          cloid: entry().cloids.takeProfit!,
          kind: 'rejected',
          role: 'takeProfit',
        },
      ]),
    ).toBe('childRejected');
    expect(
      classifyPerpsProAttachedTpSlReconciliation([
        { cloid: entry().cloids.parent, kind: 'accepted', role: 'parent' },
        {
          cloid: entry().cloids.stopLoss!,
          kind: 'unresolved',
          role: 'stopLoss',
        },
      ]),
    ).toBe('partialOutcome');
    expect(
      classifyPerpsProAttachedTpSlReconciliation([
        { cloid: entry().cloids.parent, kind: 'unresolved', role: 'parent' },
      ]),
    ).toBe('unknownOutcome');
  });

  it('queries every cloid with the frozen address and upgrades all found legs', async () => {
    const deps = dependencies();

    const result = await reconcilePerpsProAttachedTpSl(entry(), deps);

    expect(result.kind).toBe('fullAccepted');
    expect(deps.getOrderStatus).toHaveBeenCalledTimes(3);
    expect(deps.getOrderStatus).toHaveBeenCalledWith(
      entry().cloids.parent,
      '0xabc',
    );
    expect(deps.getOpenOrders).toHaveBeenCalledWith('0xabc', '');
    expect(deps.getClearinghouse).toHaveBeenCalledWith('0xabc', '');
  });

  it('does not treat repeated unknownOid as proof of no submission', async () => {
    const deps = dependencies();
    deps.getOrderStatus.mockResolvedValue({ status: 'unknownOid' });

    const result = await reconcilePerpsProAttachedTpSl(entry(), deps);

    expect(result.kind).toBe('unknownOutcome');
    expect(deps.getOrderStatus).toHaveBeenCalledTimes(9);
    expect(deps.sleep).toHaveBeenNthCalledWith(1, 250);
    expect(deps.sleep).toHaveBeenNthCalledWith(2, 750);
  });

  it('preserves known accepted legs when later status lookup fails', async () => {
    const deps = dependencies();
    deps.getOrderStatus.mockRejectedValue(new Error('network timeout'));
    const journal = entry();
    journal.legs = [
      {
        cloid: journal.cloids.parent,
        kind: 'accepted',
        oid: 7,
        role: 'parent',
      },
    ];

    const result = await reconcilePerpsProAttachedTpSl(journal, deps);

    expect(result.kind).toBe('partialOutcome');
    expect(result.legs[0]).toMatchObject({ kind: 'accepted', oid: 7 });
  });

  it('uses a matching nested open order as positive cloid evidence', async () => {
    const deps = dependencies();
    deps.getOrderStatus.mockResolvedValue({ status: 'unknownOid' });
    const tp = entry().cloids.takeProfit!;
    deps.getOpenOrders.mockResolvedValue([
      {
        ...order(tp, 22).order,
        children: [],
      },
    ]);

    const result = await reconcilePerpsProAttachedTpSl(entry(), deps);

    expect(result.kind).toBe('partialOutcome');
    expect(result.legs).toContainEqual(
      expect.objectContaining({ cloid: tp, kind: 'accepted', oid: 22 }),
    );
  });
});
