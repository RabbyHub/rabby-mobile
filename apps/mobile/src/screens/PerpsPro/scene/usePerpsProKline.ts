import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_PERPS_CANDLE_INTERVAL,
  type PerpsCandleInterval,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import { selectPerpsDisplayCandles } from '@/hooks/perps/candles/candle';
import {
  getPerpsCandleSourceIdentity,
  isPerpsCandleSourceSnapshotFresh,
  loadPerpsCandleSourceSnapshot,
  type PerpsCandleSourceSnapshot,
} from '@/hooks/perps/candles/sourceSnapshot';
import { usePerpsCandleFeed } from '@/hooks/perps/candles/usePerpsCandleFeed';

type KlinePreferenceState = {
  hydrated: boolean;
  interval: PerpsCandleInterval;
};

export const usePerpsProKline = ({
  coin,
  enabled,
  preloadEnabled = enabled,
}: {
  coin: string;
  enabled: boolean;
  preloadEnabled?: boolean;
}) => {
  const [preference, setPreference] = useState<KlinePreferenceState>({
    hydrated: false,
    interval: DEFAULT_PERPS_CANDLE_INTERVAL,
  });
  const lifecycleGenerationRef = useRef(0);
  const writeGenerationRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistedIntervalRef = useRef<PerpsCandleInterval>(
    DEFAULT_PERPS_CANDLE_INTERVAL,
  );
  const [preloadedSnapshot, setPreloadedSnapshot] =
    useState<PerpsCandleSourceSnapshot | null>(null);
  const [preloadError, setPreloadError] = useState<Error | null>(null);

  useEffect(() => {
    const lifecycleGeneration = lifecycleGenerationRef.current + 1;
    lifecycleGenerationRef.current = lifecycleGeneration;
    let active = true;

    apisPerps
      .getSelectedKlineInterval()
      .then(interval => {
        if (active && lifecycleGenerationRef.current === lifecycleGeneration) {
          persistedIntervalRef.current = interval;
          setPreference({ hydrated: true, interval });
        }
      })
      .catch(error => {
        console.error('[PerpsPro] read K-line interval failed', error);
        if (active && lifecycleGenerationRef.current === lifecycleGeneration) {
          persistedIntervalRef.current = DEFAULT_PERPS_CANDLE_INTERVAL;
          setPreference({
            hydrated: true,
            interval: DEFAULT_PERPS_CANDLE_INTERVAL,
          });
        }
      });

    return () => {
      active = false;
      if (lifecycleGenerationRef.current === lifecycleGeneration) {
        lifecycleGenerationRef.current += 1;
        writeGenerationRef.current += 1;
      }
    };
  }, []);

  const selectInterval = useCallback(
    (interval: PerpsCandleInterval) => {
      if (!preference.hydrated || interval === preference.interval) {
        return;
      }

      const lifecycleGeneration = lifecycleGenerationRef.current;
      const writeGeneration = writeGenerationRef.current + 1;
      writeGenerationRef.current = writeGeneration;
      setPreference({ hydrated: true, interval });

      const persistence = writeQueueRef.current.then(() =>
        apisPerps.setSelectedKlineInterval(interval),
      );
      writeQueueRef.current = persistence.catch(() => undefined);
      persistence
        .then(() => {
          if (lifecycleGenerationRef.current === lifecycleGeneration) {
            persistedIntervalRef.current = interval;
          }
        })
        .catch(error => {
          console.error('[PerpsPro] persist K-line interval failed', error);
          if (
            lifecycleGenerationRef.current !== lifecycleGeneration ||
            writeGenerationRef.current !== writeGeneration
          ) {
            return;
          }
          setPreference({
            hydrated: true,
            interval: persistedIntervalRef.current,
          });
        });
    },
    [preference.hydrated, preference.interval],
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
