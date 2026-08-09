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
  maxLeverage,
  onlyIsolated,
  position,
  recommended,
}: {
  maxLeverage: number;
  onlyIsolated: boolean;
  position?: PerpsProLeverageConfiguration | null;
  recommended?: PerpsProLeverageConfiguration | null;
}): PerpsProLeverageConfiguration => {
  const max = Math.max(1, Math.round(maxLeverage || 1));
  const selected = normalize(position, max) ??
    normalize(recommended, max) ?? {
      type: 'isolated' as const,
      value: max,
    };
  return {
    type: onlyIsolated ? 'isolated' : selected.type,
    value: selected.value,
  };
};
