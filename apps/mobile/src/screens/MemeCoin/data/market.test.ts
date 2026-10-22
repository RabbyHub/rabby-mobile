import type { TokenMarketTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { deriveMemeHoldings, filterBySymbol, toMemeMarketItem } from './market';
import type { MemeMarketItem } from './types';

const marketItem = (
  over: Partial<TokenMarketTokenItem> = {},
): TokenMarketTokenItem => ({
  id: '0xAbC',
  chain: 'eth',
  name: 'Pepe',
  symbol: 'PEPE',
  display_symbol: '',
  logo_url: 'https://logo/pepe.png',
  is_verified: true,
  is_core: true,
  credit_score: 0,
  price: 0.00001,
  price_24h_change: 0.0824,
  volume_24h: 0,
  fdv: 6e8,
  launchpad: null,
  asset: null,
  ...over,
});

const meme = (over: Partial<MemeMarketItem> = {}): MemeMarketItem => ({
  id: '0xabc',
  chain: 'eth',
  symbol: 'PEPE',
  logoUrl: '',
  price: 1,
  marketCap: 1,
  change24h: 0,
  ...over,
});

describe('toMemeMarketItem', () => {
  it('maps fdv to marketCap and keeps the 24h change as a ratio', () => {
    expect(toMemeMarketItem(marketItem())).toEqual({
      id: '0xAbC',
      chain: 'eth',
      symbol: 'PEPE',
      logoUrl: 'https://logo/pepe.png',
      price: 0.00001,
      marketCap: 6e8,
      change24h: 0.0824,
    });
  });

  it('prefers display_symbol and turns missing numbers into 0', () => {
    expect(
      toMemeMarketItem(
        marketItem({
          display_symbol: 'PEPE2',
          fdv: null as unknown as number,
          price_24h_change: null as unknown as number,
        }),
      ),
    ).toMatchObject({ symbol: 'PEPE2', marketCap: 0, change24h: 0 });
  });
});

describe('filterBySymbol', () => {
  const list = [meme({ symbol: 'PEPE' }), meme({ symbol: 'BONK' })];

  it('matches a case-insensitive trimmed substring', () => {
    expect(filterBySymbol(list, '  pe ', m => m.symbol)).toEqual([list[0]]);
  });

  it('returns the same list for an empty keyword', () => {
    expect(filterBySymbol(list, '  ', m => m.symbol)).toBe(list);
  });
});

describe('deriveMemeHoldings', () => {
  const pepe = meme({ id: '0xabc', chain: 'eth', symbol: 'PEPE' });
  const bonk = meme({ id: 'bonk', chain: 'bsc', symbol: 'BONK' });

  it('intersects by chain and lowercase id, sorted by value desc', () => {
    const result = deriveMemeHoldings(
      [
        { id: '0xABC', chain: 'eth', amount: 10, price: 1, usd_value: 10 },
        { id: 'bonk', chain: 'bsc', amount: 5, price: 6, usd_value: 30 },
        { id: '0xabc', chain: 'base', amount: 99, price: 1, usd_value: 99 },
        { id: '0xusdc', chain: 'eth', amount: 50, price: 1, usd_value: 50 },
      ],
      [pepe, bonk],
    );
    expect(result.holdings).toEqual([
      { meme: bonk, amount: 5, valueUsd: 30 },
      { meme: pepe, amount: 10, valueUsd: 10 },
    ]);
    expect(result.totalUsd).toBe(40);
  });

  it('skips zero balances and falls back to amount × price', () => {
    const result = deriveMemeHoldings(
      [
        { id: '0xabc', chain: 'eth', amount: 0, price: 1, usd_value: 0 },
        { id: 'bonk', chain: 'bsc', amount: 2, price: 3 },
      ],
      [pepe, bonk],
    );
    expect(result.holdings).toEqual([{ meme: bonk, amount: 2, valueUsd: 6 }]);
    expect(result.totalUsd).toBe(6);
  });
});
