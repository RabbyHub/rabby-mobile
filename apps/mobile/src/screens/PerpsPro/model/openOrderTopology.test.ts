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

  it('deduplicates repeated order ids before either projection consumes them', () => {
    const topology = buildPerpsOpenOrderTopology([
      order({ children: [order({ oid: 2 })], oid: 1 }),
      order({ oid: 2 }),
    ]);

    expect(topology.nodes.map(node => node.order.oid)).toEqual([1, 2]);
    expect(topology.nodes[1]).toMatchObject({
      isTopLevel: false,
      parentOid: 1,
      rootParentOid: 1,
    });
  });
});
