import type { PerpsOpenOrderViewModel } from './openOrder';
import {
  calculateOpenOrderEditEstimatedPnl,
  getOpenOrderEditCoveragePercent,
  isMatchingPartialTpSlPosition,
  resolveBasicOrderEditBaseSize,
} from './openOrderEdit';
import type { PerpsPositionViewModel } from './position';

const order = {
  amountBase: '1',
  amountQuote: '100',
  category: 'conditional',
  coin: 'BTC',
  displayAmountQuote: '50',
  editKind: 'partialTpSlMarket',
  executionPrice: null,
  executionPriceKind: 'market',
  filledQuote: '0',
  filledRatio: '0',
  filledSize: '0',
  isPositionTpsl: false,
  isTopLevel: true,
  isTrigger: true,
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

const position = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '90',
  key: 'BTC',
  leverage: 2,
  liquidationPrice: null,
  margin: '45',
  marginMode: 'cross',
  marginRatio: null,
  maxLeverage: 10,
  pnl: '10',
  quoteSize: '100',
  roiRatio: '0.1',
  tpslOrders: [],
} satisfies PerpsPositionViewModel;

describe('Perps Pro open order edit model', () => {
  it('requires a closing-side live position for Partial TP/SL edit', () => {
    expect(isMatchingPartialTpSlPosition(order, position)).toBe(true);
    expect(
      isMatchingPartialTpSlPosition(order, {
        ...position,
        direction: 'short',
      }),
    ).toBe(false);
    expect(isMatchingPartialTpSlPosition(order, null)).toBe(false);
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

  it('keeps coverage bounded and derives directional PnL', () => {
    expect(
      getOpenOrderEditCoveragePercent({ positionSize: '2', size: '0.5' }),
    ).toBe(25);
    expect(
      getOpenOrderEditCoveragePercent({ positionSize: '1', size: '2' }),
    ).toBe(100);
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
