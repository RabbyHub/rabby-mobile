import { getPerpsProOrderErrorText } from './orderError';

const t = (key: string) => key;

describe('getPerpsProOrderErrorText', () => {
  it.each([
    ['buy', 'aloBuyWouldMatch'],
    ['sell', 'aloSellWouldMatch'],
  ] as const)('maps the Hyperliquid bad ALO rejection for %s', (side, key) => {
    expect(
      getPerpsProOrderErrorText({
        message:
          'Post only order would have immediately matched, bbo was 100.95@100.96. asset=5',
        side,
        t,
      }),
    ).toBe(`page.perps.pro.orderError.${key}`);
  });

  it.each([
    [
      'buy',
      'Alo order price must be lower than best ask price',
      'aloBuyWouldMatch',
    ],
    [
      'sell',
      'Alo order price must be higher than best bid price',
      'aloSellWouldMatch',
    ],
  ] as const)(
    'normalizes a side-specific %s rejection',
    (side, message, key) => {
      expect(getPerpsProOrderErrorText({ message, side, t })).toBe(
        `page.perps.pro.orderError.${key}`,
      );
    },
  );

  it('maps known lines once while preserving adjacent guidance', () => {
    expect(
      getPerpsProOrderErrorText({
        message:
          'badAloPxRejected\nbadAloPxRejected\nCheck Open Orders before retrying.',
        side: 'sell',
        t,
      }),
    ).toBe(
      'page.perps.pro.orderError.aloSellWouldMatch\nCheck Open Orders before retrying.',
    );
  });

  it('preserves an unknown server rejection verbatim', () => {
    const message = 'Order must have minimum value of $10.\nRetry later.';
    expect(getPerpsProOrderErrorText({ message, side: 'buy', t })).toBe(
      message,
    );
  });

  it('does not map a side-specific message that contradicts the command side', () => {
    const message = 'Alo order price must be higher than best bid price';
    expect(getPerpsProOrderErrorText({ message, side: 'buy', t })).toBe(
      message,
    );
  });
});
