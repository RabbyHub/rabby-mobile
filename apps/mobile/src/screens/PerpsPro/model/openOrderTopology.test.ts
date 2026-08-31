import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

import { buildPerpsOpenOrderTopology } from './openOrderTopology';

const order = (overrides: Partial<OpenOrder> = {}): OpenOrder => ({
  coin: 'BTC',
  isPositionTpsl: false,
  isTrigger: false,
  limitPx: '100',
  oid: 1,
  orderType: 'Limit',
  origSz: '1',
  reduceOnly: false,
  side: 'B',
  sz: '1',
  tif: 'Gtc',
  timestamp: 1,
  triggerCondition: '',
  triggerPx: '0',
  ...overrides,
});

describe('Perps Pro open order topology', () => {
  it('preserves parent and root identity while indexing one snapshot by coin', () => {
    const topology = buildPerpsOpenOrderTopology([
      order({
        children: [
          order({
            children: [order({ coin: 'ETH', oid: 3 })],
            oid: 2,
          }),
        ],
        oid: 1,
      }),
      order({ coin: 'ETH', oid: 4 }),
    ]);

    expect(topology.nodes).toEqual([
      expect.objectContaining({
        isTopLevel: true,
        parentOid: null,
        rootParentOid: null,
      }),
      expect.objectContaining({
        isTopLevel: false,
        parentOid: 1,
        rootParentOid: 1,
      }),
      expect.objectContaining({
        isTopLevel: false,
        parentOid: 2,
        rootParentOid: 1,
      }),
      expect.objectContaining({
        isTopLevel: true,
        parentOid: null,
        rootParentOid: null,
      }),
    ]);
    expect(
      topology.nodesByCoin.get('ETH')?.map(node => node.order.oid),
    ).toEqual([3, 4]);
    expect(
      topology.topLevelNodesByCoin.get('ETH')?.map(node => node.order.oid),
    ).toEqual([4]);
  });

  it.each(['childrenFirst', 'parentFirst'] as const)(
    'normalizes repeated normalTpsl children when the server returns %s',
    orderKind => {
      const outerChildren = [order({ oid: 2 }), order({ oid: 3 })];
      const parent = order({
        children: [order({ oid: 2 }), order({ oid: 3 })],
        oid: 10,
      });
      const topology = buildPerpsOpenOrderTopology(
        orderKind === 'childrenFirst'
          ? [...outerChildren, parent]
          : [parent, ...outerChildren],
      );

      expect(topology.nodes.map(node => node.order.oid)).toEqual([10, 2, 3]);
      expect(
        topology.nodes.map(({ isTopLevel, order: item, parentOid }) => ({
          isTopLevel,
          oid: item.oid,
          parentOid,
        })),
      ).toEqual([
        { isTopLevel: true, oid: 10, parentOid: null },
        { isTopLevel: false, oid: 2, parentOid: 10 },
        { isTopLevel: false, oid: 3, parentOid: 10 },
      ]);
      expect(
        topology.topLevelNodesByCoin.get('BTC')?.map(node => node.order.oid),
      ).toEqual([10]);
    },
  );

  it('keeps a standalone fixed-size trigger top-level beside grouped children', () => {
    const topology = buildPerpsOpenOrderTopology([
      order({ oid: 2 }),
      order({ oid: 4 }),
      order({ children: [order({ oid: 2 })], oid: 10 }),
    ]);

    expect(
      topology.topLevelNodesByCoin.get('BTC')?.map(node => node.order.oid),
    ).toEqual([4, 10]);
  });
});
