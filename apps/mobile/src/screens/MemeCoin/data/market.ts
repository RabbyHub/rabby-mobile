import type {
  MemeUserPnlResult,
  RawMemePnlPoint,
  RawMemePosition,
  RawMemeToken,
} from '@/core/chaintable/types';
import { tokenKey } from '../engine/keys';
import type {
  MemeHolding,
  MemeMarketItem,
  MemePnl,
  MemePnlPoint,
  MemeToken,
} from './types';

const toMemeToken = (raw: Omit<RawMemeToken, 'fdv_usd'>): MemeToken => ({
  id: raw.id,
  chain: raw.chain_id,
  symbol: raw.symbol,
  logoUrl: raw.logo_url ?? '',
  price: raw.price,
  change24h: raw.price_24h_change,
});

export const toMemeMarketItem = (raw: RawMemeToken): MemeMarketItem => ({
  ...toMemeToken(raw),
  marketCap: raw.fdv_usd,
});

export const toMemeHolding = (raw: RawMemePosition): MemeHolding => ({
  meme: toMemeToken(raw),
  amount: raw.amount,
  valueUsd: raw.usd_value,
});

const toPnlPoints = (curve: RawMemePnlPoint[]): MemePnlPoint[] =>
  curve.map(point => ({
    timestamp: new Date(point.time_at).getTime(),
    value: point.pnl_usd_value,
  }));

export const toMemePnl = (raw: MemeUserPnlResult): MemePnl => ({
  periods: {
    '24h': {
      totalUsd: raw.total_pnl_24h_usd_value,
      points: toPnlPoints(raw.curve_24h),
    },
    all: {
      totalUsd: raw.total_pnl_all_usd_value,
      points: toPnlPoints(raw.curve_all),
    },
  },
  byToken: Object.fromEntries(
    raw.positions.map(position => [
      tokenKey({ chain: position.chain_id, id: position.id }),
      position.pnl_all_usd_value,
    ]),
  ),
});

export const appendByTokenKey = <T extends MemeToken>(
  list: T[],
  more: T[],
): T[] => {
  const seen = new Set(list.map(item => tokenKey(item)));
  const added = more.filter(item => {
    const key = tokenKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return added.length ? [...list, ...added] : list;
};
