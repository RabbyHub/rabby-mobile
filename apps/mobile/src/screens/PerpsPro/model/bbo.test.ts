import { buildPerpsProBboPrices, resolvePerpsProBboPrice } from './bbo';

const level = (px: string) => ({ n: 1, px, sz: '1' });

describe('Perps Pro BBO model', () => {
  const prices = buildPerpsProBboPrices({
    coin: 'BTC',
    levels: [
      ['99', '98', '97', '96', '95'].map(level),
      ['101', '102', '103', '104', '105'].map(level),
    ],
    time: 1,
  });

  it.each([
    [true, 'cp1', '101'],
    [true, 'cp5', '105'],
    [true, 'q1', '99'],
    [true, 'q5', '95'],
    [false, 'cp1', '99'],
    [false, 'cp5', '95'],
    [false, 'q1', '101'],
    [false, 'q5', '105'],
  ] as const)('maps side=%s strategy=%s', (isBuy, strategy, expected) => {
    expect(resolvePerpsProBboPrice({ isBuy, prices, strategy })).toBe(expected);
  });

  it('does not degrade a missing fifth level to the first level', () => {
    const shallow = buildPerpsProBboPrices({
      coin: 'BTC',
      levels: [[level('99')], [level('101')]],
      time: 1,
    });
    expect(
      resolvePerpsProBboPrice({
        isBuy: true,
        prices: shallow,
        strategy: 'cp5',
      }),
    ).toBeNull();
  });
});
