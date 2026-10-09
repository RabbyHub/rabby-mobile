import type { SpotMeta } from '@rabby-wallet/hyperliquid-sdk';

import {
  buildSpotMarkets,
  filterSpotMarkets,
  formatSpotPrice,
  formatSpotSize,
  getSpotMarketOrderPrice,
  getSpotMaxSize,
  isSpotOpenOrder,
  sortSpotMarkets,
  validateSpotOrder,
} from './spotMarkets';

const spotMeta: SpotMeta = {
  tokens: [
    { name: 'USDC', index: 0, szDecimals: 8 },
    { name: 'PURR', index: 1, szDecimals: 0 },
    { name: 'HYPE', index: 150, szDecimals: 2 },
    { name: 'DEAD', index: 200, szDecimals: 1 },
  ],
  universe: [
    { name: 'PURR/USDC', index: 0, tokens: [1, 0], isCanonical: true },
    { name: '@107', index: 107, tokens: [150, 0] },
    { name: '@300', index: 300, tokens: [200, 0] },
    // Unknown token index: dropped.
    { name: '@301', index: 301, tokens: [999, 0] },
  ],
};

const mids = { 'PURR/USDC': '0.2', '@107': '38.5' };

describe('buildSpotMarkets', () => {
  it('maps the universe to markets keyed by pair name', () => {
    const markets = buildSpotMarkets(spotMeta, mids);
    expect(markets).toHaveLength(3);
    expect(markets[1]).toEqual({
      pairIndex: 107,
      coin: '@107',
      baseName: 'HYPE',
      quoteName: 'USDC',
      baseTokenIndex: 150,
      quoteTokenIndex: 0,
      szDecimals: 2,
      isCanonical: false,
      midPx: '38.5',
    });
  });

  it('returns nothing without meta', () => {
    expect(buildSpotMarkets(null, mids)).toEqual([]);
  });
});

describe('sortSpotMarkets / filterSpotMarkets', () => {
  it('drops unpriced pairs and puts canonical pairs first', () => {
    const sorted = sortSpotMarkets(buildSpotMarkets(spotMeta, mids));
    expect(sorted.map(m => m.coin)).toEqual(['PURR/USDC', '@107']);
  });

  it('matches base names and pair names case-insensitively', () => {
    const markets = buildSpotMarkets(spotMeta, mids);
    expect(filterSpotMarkets(markets, 'hy').map(m => m.coin)).toEqual(['@107']);
    expect(filterSpotMarkets(markets, 'purr/u').map(m => m.coin)).toEqual([
      'PURR/USDC',
    ]);
    expect(filterSpotMarkets(markets, '  ')).toHaveLength(3);
  });
});

describe('formatSpotSize', () => {
  it('rounds down to szDecimals', () => {
    expect(formatSpotSize('1.239', 2)).toBe('1.23');
    expect(formatSpotSize('15.9', 0)).toBe('15');
    expect(formatSpotSize('-1', 2)).toBe('0');
    expect(formatSpotSize('abc', 2)).toBe('0');
  });
});

describe('formatSpotPrice', () => {
  it('keeps 5 significant figures', () => {
    expect(formatSpotPrice('38.51234', 2)).toBe('38.512');
    expect(formatSpotPrice('0.2000049', 0)).toBe('0.2');
  });

  it('caps decimals at 8 - szDecimals', () => {
    expect(formatSpotPrice('0.000123456', 4)).toBe('0.0001');
    expect(formatSpotPrice('0.000123456', 0)).toBe('0.00012346');
  });

  it('always allows integer prices', () => {
    expect(formatSpotPrice('123456.7', 2)).toBe('123457');
    expect(formatSpotPrice('12345.4', 2)).toBe('12345');
  });

  it('honours the rounding mode', () => {
    expect(formatSpotPrice('1.23456', 2, 1)).toBe('1.2345');
    expect(formatSpotPrice('1.23451', 2, 0)).toBe('1.2346');
  });
});

describe('getSpotMarketOrderPrice', () => {
  it('crosses the mid by the slippage without exceeding it', () => {
    expect(getSpotMarketOrderPrice('38.5', 'buy', 2)).toBe('40.425');
    expect(getSpotMarketOrderPrice('38.5', 'sell', 2)).toBe('36.575');
    expect(getSpotMarketOrderPrice('1.11111', 'buy', 2, 0.1)).toBe('1.2222');
  });
});

describe('validateSpotOrder', () => {
  const base = {
    side: 'buy' as const,
    size: '1',
    price: '38.5',
    szDecimals: 2,
    baseAvailable: '0',
    quoteAvailable: '100',
  };

  it('accepts a funded order', () => {
    expect(validateSpotOrder(base)).toBeNull();
  });

  it('rejects empty sizes and prices', () => {
    expect(validateSpotOrder({ ...base, size: '0.001' })).toBe('invalidSize');
    expect(validateSpotOrder({ ...base, price: '0' })).toBe('invalidPrice');
  });

  it('enforces the 10 USDC minimum', () => {
    expect(validateSpotOrder({ ...base, size: '0.25' })).toBe(
      'belowMinNotional',
    );
  });

  it('checks quote balance on buys and base balance on sells', () => {
    expect(validateSpotOrder({ ...base, size: '3' })).toBe(
      'insufficientBalance',
    );
    expect(validateSpotOrder({ ...base, side: 'sell' })).toBe(
      'insufficientBalance',
    );
    expect(
      validateSpotOrder({ ...base, side: 'sell', baseAvailable: '1' }),
    ).toBeNull();
  });
});

describe('getSpotMaxSize', () => {
  it('uses the quote balance at price for buys', () => {
    expect(
      getSpotMaxSize({
        side: 'buy',
        price: '38.5',
        szDecimals: 2,
        baseAvailable: '5',
        quoteAvailable: '100',
      }),
    ).toBe('2.59');
  });

  it('uses the base balance for sells', () => {
    expect(
      getSpotMaxSize({
        side: 'sell',
        price: '38.5',
        szDecimals: 1,
        baseAvailable: '5.67',
        quoteAvailable: '100',
      }),
    ).toBe('5.6');
  });
});

describe('isSpotOpenOrder', () => {
  it('detects spot market keys', () => {
    expect(isSpotOpenOrder({ coin: '@107' })).toBe(true);
    expect(isSpotOpenOrder({ coin: 'PURR/USDC' })).toBe(true);
    expect(isSpotOpenOrder({ coin: 'BTC' })).toBe(false);
    expect(isSpotOpenOrder({ coin: 'xyz:TSLA' })).toBe(false);
  });
});
