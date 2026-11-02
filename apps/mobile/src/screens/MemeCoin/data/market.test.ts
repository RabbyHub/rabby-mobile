import type { RawMemePosition, RawMemeToken } from '@/core/chaintable/types';
import {
  appendByTokenKey,
  toMemeHolding,
  toMemeMarketItem,
  toMemePnl,
} from './market';

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

describe('toMemePnl', () => {
  const pnl = toMemePnl({
    owner: '0xowner',
    total_pnl_24h_usd_value: 11.1,
    total_cost_usd_value: 100,
    total_pnl_all_usd_value: -30.8,
    positions: [
      {
        chain_id: 'hood',
        id: '0xAbC',
        pnl_24h_usd_value: null,
        cost_usd_value: 100,
        pnl_all_usd_value: -30.8,
      },
    ],
    curve_24h: [
      { time_at: '2026-11-01T07:00:00Z', pnl_usd_value: 0 },
      { time_at: '2026-11-02T07:13:00Z', pnl_usd_value: 11.1 },
    ],
    curve_all: [{ time_at: '2026-11-02T07:13:00Z', pnl_usd_value: -30.8 }],
  });

  it('keeps each period total with its curve', () => {
    expect(pnl.periods).toEqual({
      '24h': {
        totalUsd: 11.1,
        points: [
          { timestamp: Date.UTC(2026, 10, 1, 7), value: 0 },
          { timestamp: Date.UTC(2026, 10, 2, 7, 13), value: 11.1 },
        ],
      },
      all: {
        totalUsd: -30.8,
        points: [{ timestamp: Date.UTC(2026, 10, 2, 7, 13), value: -30.8 }],
      },
    });
  });

  it('indexes the all-time P&L by the same key the holdings use', () => {
    const holdingKey = 'hood:0xabc';
    expect(pnl.byToken).toEqual({ [holdingKey]: -30.8 });
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
