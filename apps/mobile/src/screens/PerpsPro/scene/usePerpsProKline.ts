import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PerpsCandleDataInterval } from '@/constant/perps';
import { selectPerpsDisplayCandles } from '@/hooks/perps/candles/candle';
import {
  updatePerpsChartPreference,
  usePerpsChartPreference,
} from '@/hooks/perps/candles/chartPreference';
import {
  getPerpsCandleSourceIdentity,
  isPerpsCandleSourceSnapshotFresh,
  loadPerpsCandleSourceSnapshot,
  type PerpsCandleSourceSnapshot,
} from '@/hooks/perps/candles/sourceSnapshot';
import { usePerpsCandleFeed } from '@/hooks/perps/candles/usePerpsCandleFeed';

export const usePerpsProKline = ({
  coin,
  enabled,
  preloadEnabled = enabled,
}: {
  coin: string;
  enabled: boolean;
  preloadEnabled?: boolean;
}) => {
  // Linked with Simple: Pro reads and writes the shared chart preference.
  const { hydrated, preference: chartPreference } = usePerpsChartPreference();
  const preference = { hydrated, interval: chartPreference.interval };
  const [preloadedSnapshot, setPreloadedSnapshot] =
    useState<PerpsCandleSourceSnapshot | null>(null);
  const [preloadError, setPreloadError] = useState<Error | null>(null);

  const selectInterval = useCallback(
    (interval: PerpsCandleDataInterval) => {
      if (!hydrated || interval === chartPreference.interval) {
        return;
      }
      // A Pro choice is a manual interval in Simple, keeping its chart style.
      updatePerpsChartPreference({ ...chartPreference, range: null, interval });
    },
    [chartPreference, hydrated],
  );

  const expectedIdentity = getPerpsCandleSourceIdentity(
    coin,
    preference.interval,
  );
  useEffect(() => {
    if (!preloadEnabled || !preference.hydrated || !coin) {
      return;
    }
    let active = true;
    setPreloadError(null);
    void loadPerpsCandleSourceSnapshot({
      coin,
      interval: preference.interval,
    })
      .then(snapshot => {
        if (active && snapshot.identity === expectedIdentity) {
          setPreloadedSnapshot(snapshot);
        }
      })
      .catch(error => {
        if (!active) {
          return;
        }
        setPreloadError(
          error instanceof Error
            ? error
            : new Error('Failed to preload Perps candles'),
        );
      });

    return () => {
      active = false;
    };
  }, [
    coin,
    expectedIdentity,
    preference.hydrated,
    preference.interval,
    preloadEnabled,
  ]);

  const matchingPreload =
    preloadedSnapshot?.identity === expectedIdentity &&
    isPerpsCandleSourceSnapshotFresh(preloadedSnapshot)
      ? preloadedSnapshot
      : null;

  const liveFeed = usePerpsCandleFeed({
    coin,
    enabled: enabled && preference.hydrated,
    initialSourceCandles: matchingPreload?.candles,
    interval: preference.interval,
  });
  const preloadedFeed = useMemo(() => {
    const candles = matchingPreload
      ? selectPerpsDisplayCandles(matchingPreload.candles, preference.interval)
      : [];
    return {
      candles,
      error: preloadError,
      identity: expectedIdentity,
      latestCandle: candles[candles.length - 1] ?? null,
      status: matchingPreload
        ? candles.length > 0
          ? ('ready' as const)
          : ('empty' as const)
        : preloadError
        ? ('error' as const)
        : preference.hydrated && coin
        ? ('loading' as const)
        : ('idle' as const),
      updateType: matchingPreload ? ('snapshot' as const) : ('reset' as const),
    };
  }, [
    coin,
    expectedIdentity,
    matchingPreload,
    preference.hydrated,
    preference.interval,
    preloadError,
  ]);
  const feed =
    !enabled || (liveFeed.status === 'loading' && matchingPreload)
      ? preloadedFeed
      : liveFeed;

  return {
    feed,
    hydrated: preference.hydrated,
    interval: preference.interval,
    loadOlder: liveFeed.loadOlder,
    selectInterval,
  };
};
