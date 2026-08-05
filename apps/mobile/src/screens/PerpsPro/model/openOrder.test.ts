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
});
