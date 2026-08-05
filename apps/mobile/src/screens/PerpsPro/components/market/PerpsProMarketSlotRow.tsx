import { perpsStore } from '@/hooks/perps/usePerpsStore';
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { buildPerpsProMarketKey } from '../../model/market';
import { buildPerpsProMarketRowModel } from '../../model/marketSelectorProjection';
import { PerpsProMarketRow } from './PerpsProMarketRow';

type PerpsProMarketSlotRowProps = {
  canonicalCoin: string;
  favorite: boolean;
  marketKey: string;
  onSelect: (marketKey: string) => void;
  onToggleFavorite: (marketKey: string) => void;
  selected: boolean;
};

const PerpsProMarketSlotRowComponent: React.FC<PerpsProMarketSlotRowProps> = ({
  canonicalCoin,
  favorite,
  marketKey,
  onSelect,
  onToggleFavorite,
  selected,
}) => {
  // AssetCtx snapshots may rebuild the global map, while unchanged MarketData
  // fields remain shallow-equal. Keep each mounted slot subscribed only to its
  // current market so a full ticker frame cannot fan out through the list.
  const source = perpsStore(
    useShallow(state => state.marketDataMap[canonicalCoin]),
  );
  const model = useMemo(() => {
    if (
      !source ||
      buildPerpsProMarketKey(source.dexId, source.name) !== marketKey
    ) {
      return null;
    }
    return buildPerpsProMarketRowModel(source);
  }, [marketKey, source]);

  if (!model) {
    return null;
  }

  return (
    <PerpsProMarketRow
      favorite={favorite}
      model={model}
      onSelect={onSelect}
      onToggleFavorite={onToggleFavorite}
      selected={selected}
    />
  );
};

export const PerpsProMarketSlotRow = React.memo(PerpsProMarketSlotRowComponent);

PerpsProMarketSlotRow.displayName = 'PerpsProMarketSlotRow';
