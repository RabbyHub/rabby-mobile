import BigNumber from 'bignumber.js';

import { APP_RUNTIME_ENV } from '@/constant/env';

export const SWAP_FEE_RATE = {
  DEFAULT: '0.25',
  HALF: '0.12',
  FREE: '0',
} as const;

export type SwapFeeRate = (typeof SWAP_FEE_RATE)[keyof typeof SWAP_FEE_RATE];

const SWAP_HALF_FEE_MIN_USD = APP_RUNTIME_ENV === 'production' ? 100_000 : 5;
const SWAP_FREE_FEE_MIN_USD = APP_RUNTIME_ENV === 'production' ? 1_000_000 : 10;

export const getRabbyFeeRate = ({
  payAmount,
  payTokenPrice,
  isFreeTokenPair,
  isWrapToken,
}: {
  payAmount: string;
  payTokenPrice: number;
  isFreeTokenPair: boolean;
  isWrapToken: boolean;
}): SwapFeeRate => {
  if (isWrapToken || isFreeTokenPair) {
    return SWAP_FEE_RATE.FREE;
  }

  const fromTokenUsdValue = new BigNumber(payAmount || 0).times(
    payTokenPrice || 0,
  );
  if (fromTokenUsdValue.gte(SWAP_FREE_FEE_MIN_USD)) {
    return SWAP_FEE_RATE.FREE;
  }
  if (fromTokenUsdValue.gte(SWAP_HALF_FEE_MIN_USD)) {
    return SWAP_FEE_RATE.HALF;
  }
  return SWAP_FEE_RATE.DEFAULT;
};
