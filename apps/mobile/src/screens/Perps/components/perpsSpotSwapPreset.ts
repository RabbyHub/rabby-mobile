import type { PerpsQuoteAsset } from '@/constant/perps';

export type PerpsSpotSwapPreset = Readonly<{
  fromCoin: PerpsQuoteAsset;
  toCoin: PerpsQuoteAsset;
}>;

export const PERPS_SPOT_SWAP_COINS: readonly PerpsQuoteAsset[] = [
  'USDC',
  'USDT',
  'USDH',
  'USDE',
];

export const resolvePerpsSpotSwapFromOptions = ({
  editableSource,
  toCoin,
}: {
  editableSource: boolean;
  toCoin: PerpsQuoteAsset;
}): readonly PerpsQuoteAsset[] => {
  if (editableSource) {
    return PERPS_SPOT_SWAP_COINS;
  }
  return toCoin === 'USDC'
    ? PERPS_SPOT_SWAP_COINS.filter(coin => coin !== 'USDC')
    : ['USDC'];
};

export const resolvePerpsSpotSwapPairAfterSelection = ({
  coin,
  currentFromCoin,
  currentToCoin,
  side,
}: {
  coin: PerpsQuoteAsset;
  currentFromCoin: PerpsQuoteAsset;
  currentToCoin: PerpsQuoteAsset;
  side: 'from' | 'to';
}): PerpsSpotSwapPreset => {
  if (side === 'from') {
    return coin === 'USDC'
      ? {
          fromCoin: coin,
          toCoin: currentToCoin === 'USDC' ? 'USDT' : currentToCoin,
        }
      : { fromCoin: coin, toCoin: 'USDC' };
  }
  return coin === 'USDC'
    ? {
        fromCoin: currentFromCoin === 'USDC' ? 'USDT' : currentFromCoin,
        toCoin: coin,
      }
    : { fromCoin: 'USDC', toCoin: coin };
};

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
