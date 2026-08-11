import { getPerpsProTpSlErrorText } from './tpSlError';

const t = (key: string, options?: { price?: string; side?: string }) =>
  `${key}${options ? `:${JSON.stringify(options)}` : ''}`;

describe('getPerpsProTpSlErrorText', () => {
  it('uses direction-specific Price copy', () => {
    expect(
      getPerpsProTpSlErrorText({
        context: { liquidationPrice: '50.00', side: 'buy' },
        error: { code: 'invalidDirection', leg: 'tp' },
        t,
      }),
    ).toBe('page.perps.pro.trade.tpSlError.tpTriggerMoreThanOrderPrice');
  });

  it('includes the formatted liquidation price for an invalid stop loss', () => {
    expect(
      getPerpsProTpSlErrorText({
        context: { liquidationPrice: '50.00', side: 'sell' },
        error: { code: 'outsideLiquidationRange', leg: 'sl' },
        t,
      }),
    ).toBe(
      'page.perps.pro.trade.tpSlError.priceAboveLiquidation:{"price":"50.00"}',
    );
  });

  it('uses the matching side for a derived non-positive trigger', () => {
    expect(
      getPerpsProTpSlErrorText({
        context: { liquidationPrice: null, side: 'buy' },
        error: { code: 'nonPositiveTrigger', leg: 'sl' },
        t,
      }),
    ).toBe(
      'page.perps.pro.trade.tpSlError.slTriggerPriceIsZero:{"side":"page.perps.pro.trade.tpSlError.sideLongBuy"}',
    );
  });
});
