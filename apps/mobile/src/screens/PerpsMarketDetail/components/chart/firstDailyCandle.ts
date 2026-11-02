import { apisPerps } from '@/core/apis/perps';
import { parsePerpsCandles } from '@/hooks/perps/candles/candle';

type FirstDay = { time: number; open: number };
type Entry = {
  expiresAt: number;
  promise: Promise<FirstDay | null>;
};
// Simple-only, bounded metadata cache. No second feed, subscription or timer.
const entries = new Map<string, Entry>();
const MAX_ENTRIES = 24;
const PENDING_TTL = 15_000;
const SUCCESS_TTL = 5 * 60_000;

export function loadFirstDailyCandle(coin: string): Promise<FirstDay | null> {
  const now = Date.now();
  const cached = entries.get(coin);
  if (cached && now < cached.expiresAt) return cached.promise;
  entries.delete(coin);
  if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  const entry: Entry = {
    expiresAt: now + PENDING_TTL,
    promise: Promise.resolve(null),
  };
  entry.promise = Promise.resolve()
    .then(() => apisPerps.getPerpsSDK().info.candleSnapshot(coin, '1d', 0, now))
    .then(response => {
      // A zero-volume backfilled day is valid. Do not substitute the first trade
      // or the first candle in the chart's capped minute/weekly snapshot.
      const first = parsePerpsCandles(response)[0];
      if (first) entry.expiresAt = Date.now() + SUCCESS_TTL;
      return first ? { time: first.time / 1000, open: first.open } : null;
    })
    .catch(() => null);
  entries.set(coin, entry);
  return entry.promise;
}

export function resetFirstDailyCandleCacheForTests() {
  entries.clear();
}
