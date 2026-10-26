import { useCallback, useMemo, useState } from 'react';

import type { PerpsBookPrecision } from '@/hooks/perps/subscriptions/perpsBookTypes';

import {
  isMatchingTickOption,
  resolvePerpsTickOption,
  type PerpsTickOption,
} from '../model/orderBook';
import {
  getPerpsProSessionBookPrecision,
  setPerpsProSessionBookPrecision,
} from '../session/perpsProMarketSession';

type PrecisionState = {
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
  const [state, setState] = useState<PrecisionState>(() => ({
    marketKey,
    precision: marketKey ? getPerpsProSessionBookPrecision(marketKey) : null,
  }));
  const preferredPrecision =
    state.marketKey === marketKey
      ? state.precision
      : marketKey
      ? getPerpsProSessionBookPrecision(marketKey)
      : null;

  const selectedTickOption = useMemo(
    () => resolvePerpsTickOption(tickOptions, preferredPrecision),
    [preferredPrecision, tickOptions],
  );

  const selectTickOption = useCallback(
    (option: PerpsTickOption) => {
      if (
        !marketKey ||
        !tickOptions.some(current => isMatchingTickOption(current, option))
      ) {
        return;
      }
      const precision: PerpsBookPrecision = {
        nSigFigs: option.nSigFigs,
        mantissa: option.mantissa,
      };

      setPerpsProSessionBookPrecision(marketKey, precision);
      setState({
        marketKey,
        precision,
      });
    },
    [marketKey, tickOptions],
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
