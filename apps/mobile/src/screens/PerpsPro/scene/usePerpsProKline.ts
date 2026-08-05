import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_PERPS_CANDLE_INTERVAL,
  type PerpsCandleInterval,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import { usePerpsCandleFeed } from '@/hooks/perps/candles/usePerpsCandleFeed';

type KlinePreferenceState = {
  hydrated: boolean;
  interval: PerpsCandleInterval;
};

export const usePerpsProKline = ({
  coin,
  enabled,
}: {
  coin: string;
  enabled: boolean;
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

  const feed = usePerpsCandleFeed({
    coin,
    enabled: enabled && preference.hydrated,
    interval: preference.interval,
  });

  return {
    feed,
    hydrated: preference.hydrated,
    interval: preference.interval,
    selectInterval,
  };
};
