import type { PerpsMarketMarginMode } from '@/constant/perps';

export type PerpsProLeverageConfiguration = {
  type: 'cross' | 'isolated';
  value: number;
};

const normalize = (
  leverage: PerpsProLeverageConfiguration | null | undefined,
  maxLeverage: number,
) => {
  if (!leverage || !Number.isFinite(leverage.value)) return null;
  return {
    type: leverage.type,
    value: Math.min(maxLeverage, Math.max(1, Math.round(leverage.value))),
  };
};

/**
 * Trade-form leverage source order:
 * 1. an existing position's authoritative configuration;
 * 2. Hyperliquid's zero-address Active Asset baseline;
 * 3. the market maximum as the explicit last fallback.
 */
export const resolvePerpsProInitialLeverage = ({
  marginModeConstraint,
  maxLeverage,
  position,
  zeroAddressBaseline,
}: {
  marginModeConstraint: PerpsMarketMarginMode;
  maxLeverage: number;
  position?: PerpsProLeverageConfiguration | null;
  zeroAddressBaseline?: PerpsProLeverageConfiguration | null;
}): PerpsProLeverageConfiguration => {
  const max = Math.max(1, Math.round(maxLeverage || 1));
  const selected = normalize(position, max) ??
    normalize(zeroAddressBaseline, max) ?? {
      type: 'isolated' as const,
      value: max,
    };
  return {
    type: marginModeConstraint === 'normal' ? selected.type : 'isolated',
    value: selected.value,
  };
};
