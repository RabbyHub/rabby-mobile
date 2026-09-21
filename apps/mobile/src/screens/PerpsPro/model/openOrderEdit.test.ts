import type { PerpsOpenOrderViewModel } from './openOrder';
import type { PerpsPositionViewModel } from './position';
import {
  calculateOpenOrderEditEstimatedPnl,
  isRelevantOpenOrderEditPosition,
  resolveBasicOrderEditBaseSize,
} from './openOrderEdit';

const order = {
  amountBase: '1',
  amountQuote: '100',
  category: 'conditional',
  cloid: null,
  coin: 'BTC',
  displayAmountQuote: '50',
  editKind: 'triggerMarket',
  executionPrice: null,
  executionPriceKind: 'market',
  filledQuote: '0',
  filledRatio: '0',
  filledSize: '0',
  hasChildren: false,
  isPositionTpsl: false,
  isTopLevel: true,
  isTrigger: true,
  limitPrice: '101.2',
  key: 'conditional:BTC:1',
  oid: 1,
  orderType: 'Take Profit Market',
  reduceOnly: true,
  remainingSize: '0.5',
  side: 'sell',
  tif: null,
  timestamp: 1,
  triggerCondition: 'Above',
  triggerKind: 'takeProfit',
  triggerPrice: '110',
} satisfies PerpsOpenOrderViewModel;

describe('Perps Pro open order edit model', () => {
  it('uses a Position only as matching reduce-only display context', () => {
    const position = {
      baseSize: '1',
      coin: 'BTC',
      direction: 'long',
    } as PerpsPositionViewModel;

    expect(isRelevantOpenOrderEditPosition(order, position)).toBe(true);
    expect(
      isRelevantOpenOrderEditPosition(
        { ...order, reduceOnly: false },
        position,
      ),
    ).toBe(false);
    expect(
      isRelevantOpenOrderEditPosition({ ...order, side: 'buy' }, position),
    ).toBe(false);
  });

  it('preserves the exact remaining base size until Amount is edited', () => {
    expect(
      resolveBasicOrderEditBaseSize({
        amountUnit: 'quote',
        draft: { amount: '60', amountTouched: false, price: '120' },
        remainingSize: '0.500009',
        szDecimals: 5,
      }),
    ).toBe('0.5');
    expect(
      resolveBasicOrderEditBaseSize({
        amountUnit: 'quote',
        draft: { amount: '60', amountTouched: true, price: '120' },
        remainingSize: '0.500009',
        szDecimals: 5,
      }),
    ).toBe('0.5');
  });

  it('derives directional PnL independently from edit eligibility', () => {
    expect(
      calculateOpenOrderEditEstimatedPnl({
        direction: 'long',
        entryPrice: '90',
        size: '0.5',
        triggerPrice: '110',
      }),
    ).toBe('10');
  });
});
