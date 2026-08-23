import type { PerpsQuoteAsset } from '@/constant/perps';

export type PerpsSpotSwapPreset = Readonly<{
  fromCoin: PerpsQuoteAsset;
  toCoin: PerpsQuoteAsset;
}>;

export const resolvePerpsSpotSwapPreset = ({
  sourceAsset,
  targetAsset,
}: {
  sourceAsset?: PerpsQuoteAsset;
  targetAsset?: PerpsQuoteAsset;
}): PerpsSpotSwapPreset | null => {
  if (targetAsset) {
    return { fromCoin: 'USDC', toCoin: targetAsset };
  }
  if (sourceAsset) {
    return {
      fromCoin: sourceAsset,
      toCoin: sourceAsset === 'USDC' ? 'USDT' : 'USDC',
    };
  }
  return null;
};
