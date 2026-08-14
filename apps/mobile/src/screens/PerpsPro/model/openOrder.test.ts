import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

import {
  buildPerpsOpenOrders,
  calculateOpenOrderProgress,
  classifyPerpsOpenOrder,
  filterPerpsOpenOrders,
  getPerpsOpenOrderCounts,
} from './openOrder';

const makeOrder = (overrides: Partial<OpenOrder> = {}): OpenOrder => ({
  coin: 'BTC',
  isPositionTpsl: false,
  isTrigger: false,
  limitPx: '50000',
  oid: 1,
  orderType: 'Limit',
  origSz: '2',
  reduceOnly: false,
  side: 'B',
  sz: '0.5',
  tif: 'Gtc',
  timestamp: 100,
  triggerCondition: '',
  triggerPx: '0',
  ...overrides,
});

describe('Perps Pro open order model', () => {
  it('classifies Basic, Conditional and unsupported orders exactly once', () => {
    expect(classifyPerpsOpenOrder(makeOrder())).toBe('basic');
    expect(
      classifyPerpsOpenOrder(
        makeOrder({
          isPositionTpsl: true,
          isTrigger: true,
          orderType: 'Take Profit Market',
        }),
      ),
    ).toBe('conditional');
    expect(classifyPerpsOpenOrder(makeOrder({ orderType: 'Twap' }))).toBe(
      'unsupported',
    );
    expect(classifyPerpsOpenOrder(makeOrder({ coin: '@123' }))).toBe(
      'unsupported',
    );
  });

  it('clamps filled size and progress for malformed snapshots', () => {
    expect(
      calculateOpenOrderProgress({ originalSize: '2', remainingSize: '0.5' }),
    ).toEqual({ filledRatio: '0.75', filledSize: '1.5' });
    expect(
      calculateOpenOrderProgress({ originalSize: '2', remainingSize: '-1' }),
    ).toEqual({ filledRatio: '1', filledSize: '2' });
    expect(
      calculateOpenOrderProgress({ originalSize: '0', remainingSize: '3' }),
    ).toEqual({ filledRatio: '0', filledSize: '0' });
    expect(
      calculateOpenOrderProgress({ originalSize: '2', remainingSize: '3' }),
    ).toEqual({ filledRatio: '0', filledSize: '0' });
    expect(
      calculateOpenOrderProgress({
        originalSize: 'invalid',
        remainingSize: '1',
      }),
    ).toEqual({ filledRatio: '0', filledSize: '0' });
  });

  it('builds deterministic rows, counts all account orders and filters display only', () => {
    const orders = buildPerpsOpenOrders([
      makeOrder({ coin: 'ETH', oid: 2, timestamp: 200 }),
      makeOrder({ coin: 'BTC', oid: 1, timestamp: 200 }),
      makeOrder({
        coin: 'BTC',
        isTrigger: true,
        oid: 3,
        orderType: 'Stop Market',
        reduceOnly: true,
        timestamp: 150,
        triggerCondition: 'Price below 45000',
        triggerPx: '45000',
      }),
      makeOrder({ coin: 'SOL', oid: 4, orderType: 'Twap', timestamp: 300 }),
    ]);

    expect(orders.map(order => order.oid)).toEqual([4, 1, 2, 3]);
    expect(getPerpsOpenOrderCounts(orders)).toEqual({
      basic: 2,
      conditional: 1,
      unsupported: 1,
    });
    expect(
      filterPerpsOpenOrders({
        canonicalCoin: 'BTC',
        category: 'basic',
        hideOtherSymbols: true,
        orders,
      }).map(order => order.oid),
    ).toEqual([1]);
    expect(orders[1]).toMatchObject({
      amountBase: '2',
      amountQuote: '100000',
      displayAmountQuote: '100000',
      filledQuote: '75000',
      filledSize: '1.5',
    });
  });

  it('uses the trigger price as the Conditional Market display reference', () => {
    const [order] = buildPerpsOpenOrders([
      makeOrder({
        isTrigger: true,
        limitPx: '0',
        origSz: '0.001',
        orderType: 'Stop Market',
        triggerCondition: 'Price below 67260',
        triggerPx: '67260',
      }),
    ]);

    expect(order).toMatchObject({
      amountQuote: '0',
      category: 'conditional',
      displayAmountQuote: '67.26',
      executionPrice: null,
      executionPriceKind: 'market',
      side: 'buy',
      triggerCondition: 'Price below 67260',
      triggerPrice: '67260',
    });
  });

  it('uses the limit price for Conditional Limit and exposes missing references', () => {
    const [limitOrder, marketOrder] = buildPerpsOpenOrders([
      makeOrder({
        isTrigger: true,
        limitPx: '67000',
        oid: 2,
        orderType: 'Stop Limit',
        origSz: '0.001',
        triggerPx: '67260',
      }),
      makeOrder({
        isTrigger: true,
        limitPx: '0',
        oid: 3,
        orderType: 'Stop Market',
        origSz: '0.001',
        triggerPx: '0',
      }),
    ]);

    expect(limitOrder.displayAmountQuote).toBe('67');
    expect(marketOrder.displayAmountQuote).toBeNull();
  });

  it('only enables the two approved top-level edit shapes', () => {
    const [basic, partial, full, opening, conditionalLimit, parent, child] =
      buildPerpsOpenOrders([
        makeOrder({ oid: 1 }),
        makeOrder({
          isTrigger: true,
          oid: 2,
          orderType: 'Take Profit Market',
          reduceOnly: true,
          side: 'A',
          triggerPx: '60000',
        }),
        makeOrder({
          isPositionTpsl: true,
          isTrigger: true,
          oid: 3,
          orderType: 'Stop Market',
          reduceOnly: true,
          sz: '0',
          triggerPx: '40000',
        }),
        makeOrder({
          isTrigger: true,
          oid: 4,
          orderType: 'Stop Market',
          reduceOnly: false,
          triggerPx: '40000',
        }),
        makeOrder({
          isTrigger: true,
          oid: 5,
          orderType: 'Stop Limit',
          reduceOnly: true,
          triggerPx: '40000',
        }),
        makeOrder({
          children: [
            makeOrder({
              isTrigger: true,
              oid: 7,
              orderType: 'Take Profit Market',
              reduceOnly: true,
              triggerPx: '60000',
            }),
          ],
          oid: 6,
        }),
      ]).sort((left, right) => left.oid - right.oid);

    expect(basic.editKind).toBe('basicLimit');
    expect(partial.editKind).toBe('partialTpSlMarket');
    expect(full.editKind).toBeNull();
    expect(opening.editKind).toBeNull();
    expect(conditionalLimit.editKind).toBeNull();
    expect(parent.editKind).toBeNull();
    expect(child).toMatchObject({ editKind: null, isTopLevel: false });
  });
});
