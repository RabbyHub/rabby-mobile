import {
  appendByTokenKey,
  filterBySymbolPrefix,
  toMemeHolding,
  toMemeMarketItem,
} from './market';
import type { RawMemePosition, RawMemeToken } from './memeApi';

const raw = (over: Partial<RawMemeToken> = {}): RawMemeToken => ({
  chain_id: 'hood',
  id: '0xAbC',
  symbol: 'PEPE',
  name: 'Pepe',
  decimals: 18,
  logo_url: 'https://logo/pepe.png',
  price: 0.00001,
  price_24h_change: 0.0824,
  fdv_usd: 6e8,
  ...over,
});

const position = (over: Partial<RawMemePosition> = {}): RawMemePosition => ({
  chain_id: 'hood',
  id: '0xAbC',
  symbol: 'PEPE',
  name: 'Pepe',
  decimals: 18,
  logo_url: null,
  price: 2,
  price_24h_change: null,
  amount: 5,
  usd_value: 10,
  ...over,
});

describe('toMemeMarketItem', () => {
  it('maps fdv_usd to marketCap and keeps the 24h change as a ratio', () => {
    expect(toMemeMarketItem(raw())).toEqual({
      id: '0xAbC',
      chain: 'hood',
      symbol: 'PEPE',
      logoUrl: 'https://logo/pepe.png',
      price: 0.00001,
      change24h: 0.0824,
      marketCap: 6e8,
    });
  });

  it('turns a null logo into an empty string and keeps a null change', () => {
    expect(
      toMemeMarketItem(raw({ logo_url: null, price_24h_change: null })),
    ).toMatchObject({ logoUrl: '', change24h: null });
  });
});

describe('toMemeHolding', () => {
  it('maps a position to a holding with usd_value as valueUsd', () => {
    expect(toMemeHolding(position())).toEqual({
      meme: {
        id: '0xAbC',
        chain: 'hood',
        symbol: 'PEPE',
        logoUrl: '',
        price: 2,
        change24h: null,
      },
      amount: 5,
      valueUsd: 10,
    });
  });
});

describe('filterBySymbolPrefix', () => {
  const list = [
    { symbol: 'DOGE-1' },
    { symbol: 'HOTDOG' },
    { symbol: 'DOGGO' },
    { symbol: 'PEPE' },
  ];

  it('matches a case-insensitive trimmed prefix', () => {
    expect(filterBySymbolPrefix(list, '  dOg ', m => m.symbol)).toEqual([
      { symbol: 'DOGE-1' },
      { symbol: 'DOGGO' },
    ]);
  });

  it('returns the same list for an empty keyword', () => {
    expect(filterBySymbolPrefix(list, '  ', m => m.symbol)).toBe(list);
  });
});

describe('appendByTokenKey', () => {
  const a = toMemeMarketItem(raw({ id: '0xA' }));
  const b = toMemeMarketItem(raw({ id: '0xb' }));

  it('appends only entries whose token key is new', () => {
    const c = toMemeMarketItem(raw({ id: '0xc' }));
    expect(
      appendByTokenKey([a, b], [toMemeMarketItem(raw({ id: '0xB' })), c]),
    ).toEqual([a, b, c]);
  });

  it('returns the same list when nothing is new', () => {
    const list = [a, b];
    expect(appendByTokenKey(list, [a])).toBe(list);
  });
});
