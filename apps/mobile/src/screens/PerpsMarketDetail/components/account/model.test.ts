import {
  accountHeaderQuote,
  closeQuantitySummary,
  createAccountHeaderPresentation,
  simpleLiquidationGap,
  simpleLiquidationPriceText,
} from './model';

describe('Simple account display contracts', () => {
  it.each([
    ['54321.6789', 0, '54,322'],
    ['23.45678', 3, '23.457'],
    ['23.4500', 3, '23.45'],
    ['23.0000', 3, '23'],
    ['23.4565', 3, '23.457'],
    ['999.9995', 3, '1,000'],
    ['0.00012345', 6, '0.000123'],
    ['1000000.125', 2, '1,000,000.13'],
    ['23.456', undefined, '23.46'],
    ['23.456', null, '23.46'],
    [null, 2, '--'],
    [undefined, 2, '--'],
    ['', 2, '--'],
    ['  ', 2, '--'],
    ['invalid', 2, '--'],
    [Infinity, 2, '--'],
    [0, 2, '--'],
    [-20, 2, '--'],
  ] as const)(
    'formats liquidation %s at precision %s as %s',
    (raw, decimals, expected) => {
      expect(simpleLiquidationPriceText(raw, decimals)).toBe(expected);
    },
  );

  it.each([
    [90, 100, '-10.00%'],
    [120, 100, '+20.00%'],
    [250, 100, '+150.00%'],
    [0, 100, '-100.00%'],
    [-20, 100, '-100.00%'],
    [100, 100, '0.00%'],
    [null, 100, '--'],
    [undefined, 100, '--'],
    ['', 100, '--'],
    ['  ', 100, '--'],
    ['--', 100, '--'],
    [NaN, 100, '--'],
    [Infinity, 100, '--'],
    [90, 0, '--'],
    [90, -1, '--'],
    [90, null, '--'],
    [90, Infinity, '--'],
    ['0.000000009', '0.00000001', '-10.00%'],
  ])('liq=%s mark=%s -> %s', (liq, mark, expected) =>
    expect(simpleLiquidationGap(liq, mark)).toBe(expected),
  );

  it('uses submitted size precision and preserves the full-size path', () => {
    expect(closeQuantitySummary('1.23456', 53, 3, 100)).toEqual({
      quantity: '0.654',
      notional: '65.40',
    });
    expect(closeQuantitySummary('1.23456', 100, 3, 100)).toEqual({
      quantity: '1.23456',
      notional: '123.46',
    });
    expect(closeQuantitySummary('1.23456', 0, 3, 100)).toEqual({
      quantity: '0.000',
      notional: '0.00',
    });
  });

  it('publishes only visible changes, catches up on activation, and keeps the real anchor', () => {
    const publish = jest.fn();
    const ui = createAccountHeaderPresentation(publish);
    const quote = accountHeaderQuote(110, 2);
    ui.quote(quote, true);
    ui.layout(62);
    for (let y = 0; y < 62; y++) ui.scroll(y);
    expect(publish).not.toHaveBeenCalled();
    ui.scroll(62);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.lastCall?.[0]).toMatchObject({
      compact: true,
      quote: { price: '$110.00' },
    });
    for (let y = 63; y < 120; y++) ui.scroll(y);
    ui.quote(accountHeaderQuote(110.000001, 2), true);
    expect(publish).toHaveBeenCalledTimes(1);
    ui.quote(accountHeaderQuote(120, 2), false);
    ui.quote(accountHeaderQuote(130, 2), false);
    expect(publish).toHaveBeenCalledTimes(1);
    ui.quote(accountHeaderQuote(130, 2), true);
    expect(publish).toHaveBeenCalledTimes(2);
    ui.scroll(61);
    expect(publish.mock.lastCall?.[0].compact).toBe(false);
    expect(publish).toHaveBeenCalledTimes(3);
  });
});
