import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { perpsServiceApi } from '@/core/serviceApi/perps';
import type { PerpsBookPrecision } from '@/core/services/perpsService';

import {
  resolvePerpsTickOption,
  type PerpsTickOption,
} from '../model/orderBook';

type PrecisionState = {
  hydrated: boolean;
  marketKey: string | null;
  precision: PerpsBookPrecision | null;
};

export const usePerpsBookPrecision = ({
  marketKey,
  tickOptions,
}: {
  marketKey: string | null;
  tickOptions: PerpsTickOption[];
}) => {
  const [state, setState] = useState<PrecisionState>({
    hydrated: false,
    marketKey: null,
    precision: null,
  });
  const lifecycleGenerationRef = useRef(0);
  const writeGenerationRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistedPrecisionRef = useRef<PerpsBookPrecision | null>(null);

  useEffect(() => {
    const lifecycleGeneration = lifecycleGenerationRef.current + 1;
    lifecycleGenerationRef.current = lifecycleGeneration;
    writeGenerationRef.current += 1;
    writeQueueRef.current = Promise.resolve();
    persistedPrecisionRef.current = null;
    let active = true;

    setState({
      hydrated: false,
      marketKey,
      precision: null,
    });

    const cleanup = () => {
      active = false;
      if (lifecycleGenerationRef.current === lifecycleGeneration) {
        lifecycleGenerationRef.current += 1;
        writeGenerationRef.current += 1;
        persistedPrecisionRef.current = null;
      }
    };

    if (!marketKey) {
      return cleanup;
    }

    perpsServiceApi
      .getPerpsBookPrecision(marketKey)
      .then(precision => {
        if (active && lifecycleGenerationRef.current === lifecycleGeneration) {
          persistedPrecisionRef.current = precision;
          setState({
            hydrated: true,
            marketKey,
            precision,
          });
        }
      })
      .catch(error => {
        console.error('[PerpsPro] read book precision failed', error);
        if (active && lifecycleGenerationRef.current === lifecycleGeneration) {
          persistedPrecisionRef.current = null;
          setState({
            hydrated: true,
            marketKey,
            precision: null,
          });
        }
      });

    return cleanup;
  }, [marketKey]);

  const selectedTickOption = useMemo(
    () =>
      state.hydrated && state.marketKey === marketKey
        ? resolvePerpsTickOption(tickOptions, state.precision)
        : null,
    [marketKey, state.hydrated, state.marketKey, state.precision, tickOptions],
  );

  const selectTickOption = useCallback(
    (option: PerpsTickOption) => {
      if (!marketKey || !state.hydrated || state.marketKey !== marketKey) {
        return;
      }

      const selectedMarketKey = marketKey;
      const lifecycleGeneration = lifecycleGenerationRef.current;
      const writeGeneration = writeGenerationRef.current + 1;
      writeGenerationRef.current = writeGeneration;
      const precision: PerpsBookPrecision = {
        nSigFigs: option.nSigFigs,
        mantissa: option.mantissa,
      };

      setState({
        hydrated: true,
        marketKey: selectedMarketKey,
        precision,
      });

      const persistence = writeQueueRef.current.then(() =>
        perpsServiceApi.setPerpsBookPrecision(selectedMarketKey, precision),
      );
      writeQueueRef.current = persistence.catch(() => undefined);
      persistence
        .then(() => {
          if (lifecycleGenerationRef.current === lifecycleGeneration) {
            persistedPrecisionRef.current = precision;
          }
        })
        .catch(error => {
          console.error('[PerpsPro] persist book precision failed', error);
          if (
            lifecycleGenerationRef.current !== lifecycleGeneration ||
            writeGenerationRef.current !== writeGeneration
          ) {
            return;
          }
          setState(current => {
            if (
              current.marketKey !== selectedMarketKey ||
              current.precision?.nSigFigs !== precision.nSigFigs ||
              current.precision?.mantissa !== precision.mantissa
            ) {
              return current;
            }
            return {
              hydrated: true,
              marketKey: selectedMarketKey,
              precision: persistedPrecisionRef.current,
            };
          });
        });
    },
    [marketKey, state.hydrated, state.marketKey],
  );

  const precision: PerpsBookPrecision | null = selectedTickOption
    ? {
        nSigFigs: selectedTickOption.nSigFigs,
        mantissa: selectedTickOption.mantissa,
      }
    : null;

  return {
    precision,
    selectTickOption,
    selectedTickOption,
  };
};
