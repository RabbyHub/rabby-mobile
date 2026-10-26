import { getPerpsProTpSlErrorText } from './tpSlError';

const t = (key: string, options?: { side?: string }) =>
  `${key}${options ? `:${JSON.stringify(options)}` : ''}`;

describe('getPerpsProTpSlErrorText', () => {
  it('uses direction-specific Price copy', () => {
    expect(
      getPerpsProTpSlErrorText({
        context: { side: 'buy' },
        error: { code: 'invalidDirection', leg: 'tp' },
        t,
      }),
    ).toBe('page.perps.pro.trade.tpSlError.tpTriggerMoreThanOrderPrice');
  });

  it('uses the matching side for a derived non-positive trigger', () => {
    expect(
      getPerpsProTpSlErrorText({
        context: { side: 'buy' },
        error: { code: 'nonPositiveTrigger', leg: 'sl' },
        t,
      }),
    ).toBe(
      'page.perps.pro.trade.tpSlError.slTriggerPriceIsZero:{"side":"page.perps.pro.trade.tpSlError.sideLongBuy"}',
    );
  });
});
