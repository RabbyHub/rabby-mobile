import { useCallback, useEffect, useRef, useState } from 'react';

import type { PerpsCandleInterval } from '@/constant/perps';
import { loadPerpsCandleSourcePage } from '@/hooks/perps/candles/sourceSnapshot';

export const SPOT_SPARKLINE_RANGES = ['1h', '1d', '1w', '1M'] as const;
export type SpotSparklineRange = (typeof SPOT_SPARKLINE_RANGES)[number];

const RANGE_SOURCE: Record<
  SpotSparklineRange,
  { interval: PerpsCandleInterval; candleCount: number }
> = {
  '1h': { interval: '1m', candleCount: 60 },
  '1d': { interval: '15m', candleCount: 96 },
  '1w': { interval: '1h', candleCount: 168 },
  '1M': { interval: '4h', candleCount: 180 },
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { closes: number[]; loadedAt: number }>();

export type SpotSparklineData = {
  closes: number[];
  isLoading: boolean;
};

/**
 * Closing prices of a spot pair over `range`, for a lightweight sparkline.
 * Fetched once per pair and range (cached for a minute), never polled.
 */
export const useSpotSparkline = (
  coin: string | null,
  range: SpotSparklineRange,
): SpotSparklineData => {
  const [state, setState] = useState<{ key: string; closes: number[] } | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    if (!coin) {
      return;
    }
    const key = `${coin}:${range}`;
    // Any fetch still in flight for a previous range must not win later.
    const generation = ++generationRef.current;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      setState({ key, closes: cached.closes });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { interval, candleCount } = RANGE_SOURCE[range];
      const candles = await loadPerpsCandleSourcePage({
        coin,
        interval,
        candleCount,
        endTime: Date.now(),
      });
      const closes = candles.map(candle => candle.close);
      cache.set(key, { closes, loadedAt: Date.now() });
      if (generation === generationRef.current) {
        setState({ key, closes });
      }
    } catch {
      // Keep the previous curve; the price header still works without it.
    } finally {
      if (generation === generationRef.current) {
        setIsLoading(false);
      }
    }
  }, [coin, range]);

  useEffect(() => {
    load();
  }, [load]);

  const key = coin ? `${coin}:${range}` : '';
  return {
    closes: state?.key === key ? state.closes : [],
    isLoading,
  };
};
