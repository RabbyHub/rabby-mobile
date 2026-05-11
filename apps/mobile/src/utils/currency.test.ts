jest.mock(
  '@rabby-wallet/biz-utils/dist/isomorphic/biz-number',
  () =>
    jest.requireActual(
      '../../../../packages/biz-utils/dist/isomorphic/biz-number.js',
    ),
  { virtual: true },
);

import {
  formatCurrencyValueParts,
  formatSmallCurrencyValueParts,
} from './currency';

describe('currency utils', () => {
  it('keeps prefix currencies in front of the amount', () => {
    const usd = {
      code: 'USD',
      symbol: '$',
      usd_rate: 1,
      logo_url: '',
      is_prefix: true,
    };

    expect(formatCurrencyValueParts(12.34, { currency: usd }).text).toBe(
      '$12.34',
    );
    expect(formatSmallCurrencyValueParts(0.001, { currency: usd }).text).toBe(
      '<$0.01',
    );
  });

  it('moves postfix currencies behind the amount and exposes styled parts', () => {
    const btc = {
      code: 'BTC',
      symbol: 'BTC',
      usd_rate: 0.00001,
      logo_url: '',
      is_prefix: false,
    };

    expect(formatCurrencyValueParts(1000, { currency: btc }).text).toBe(
      '0.01 BTC',
    );
    expect(formatSmallCurrencyValueParts(1000, { currency: btc }).text).toBe(
      '0.01 BTC',
    );
    expect(formatCurrencyValueParts(1000, { currency: btc })).toMatchObject({
      amountText: '0.01',
      symbol: 'BTC',
      isPrefix: false,
    });
    expect(formatSmallCurrencyValueParts(0, { currency: btc })).toMatchObject({
      text: '0 BTC',
      amountText: '0',
    });
    expect(formatSmallCurrencyValueParts(50, { currency: btc }).text).toBe(
      '0.0005 BTC',
    );
    expect(formatSmallCurrencyValueParts(1, { currency: btc }).text).toBe(
      '0.0\u20841 BTC',
    );
    expect(
      formatSmallCurrencyValueParts(1_260_000, { currency: btc }).text,
    ).toBe('12.6 BTC');
  });
});
