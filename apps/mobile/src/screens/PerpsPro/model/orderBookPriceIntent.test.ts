import { resolvePerpsProOrderBookPriceIntent } from './orderBookPriceIntent';

const attachedTpSl = {
  enabled: true,
  sl: { mode: 'roi' as const, rawMagnitude: '' },
  tp: { mode: 'price' as const, rawMagnitude: '' },
};

describe('resolvePerpsProOrderBookPriceIntent', () => {
  it.each([
    ['amount', { type: 'dismissKeyboard' }],
    ['tp', { type: 'attachedTpSlPrice', leg: 'tp' }],
    ['sl', { type: 'dismissKeyboard' }],
    [null, { type: 'tradePrice' }],
  ] as const)(
    'routes %s focus without relying on blur order',
    (focusOwner, expected) => {
      expect(
        resolvePerpsProOrderBookPriceIntent({ attachedTpSl, focusOwner }),
      ).toEqual(expected);
    },
  );

  it('dismisses a stale TP/SL focus after attached inputs are disabled', () => {
    expect(
      resolvePerpsProOrderBookPriceIntent({
        attachedTpSl: { ...attachedTpSl, enabled: false },
        focusOwner: 'tp',
      }),
    ).toEqual({ type: 'dismissKeyboard' });
  });
});
