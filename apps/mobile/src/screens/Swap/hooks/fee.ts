import BigNumber from 'bignumber.js';
import { STABLE_TOKEN_POOL } from '@rabby-wallet/rabby-swap';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

export const SWAP_FEE_RATE = {
  DEFAULT: '0.25',
  HALF: '0.12',
  FREE: '0',
} as const;

export type SwapFeeRate = (typeof SWAP_FEE_RATE)[keyof typeof SWAP_FEE_RATE];

export const RABBY_FEE_TIERS = {
  default: SWAP_FEE_RATE.DEFAULT,
  wrap: SWAP_FEE_RATE.FREE,
  stablecoins: SWAP_FEE_RATE.FREE,
  lstLrt: SWAP_FEE_RATE.FREE,
  million: SWAP_FEE_RATE.FREE,
  hundredThousand: SWAP_FEE_RATE.HALF,
} as const;

export type RabbyFeeTier = keyof typeof RABBY_FEE_TIERS;

export const RABBY_FEE_DISCOUNT_CASES = {
  swap: ['stablecoins', 'lstLrt', 'million', 'hundredThousand'],
  bridge: ['million', 'hundredThousand'],
} as const satisfies Record<string, readonly RabbyFeeTier[]>;

const SWAP_HALF_FEE_MIN_USD = 100_000;
const SWAP_FREE_FEE_MIN_USD = 1_000_000;
const stableTokenKeys = new Set(
  STABLE_TOKEN_POOL.map(
    token => `${token.chain.toLowerCase()}:${token.id.toLowerCase()}`,
  ),
);

type RabbyFeeParams = {
  payAmount: string;
  payTokenPrice: number;
  isFreeTokenPair: boolean;
  isWrapToken: boolean;
  payToken?: Pick<TokenItem, 'id' | 'chain'>;
};

export const getRabbyFeeInfo = ({
  payAmount,
  payTokenPrice,
  isFreeTokenPair,
  isWrapToken,
  payToken,
}: RabbyFeeParams): { feeRate: SwapFeeRate; feeTier: RabbyFeeTier } => {
  let feeTier: RabbyFeeTier;
  if (isWrapToken) {
    feeTier = 'wrap';
  } else if (isFreeTokenPair) {
    feeTier =
      payToken &&
      stableTokenKeys.has(
        `${payToken.chain.toLowerCase()}:${payToken.id.toLowerCase()}`,
      )
        ? 'stablecoins'
        : 'lstLrt';
  } else {
    const fromTokenUsdValue = new BigNumber(payAmount || 0).times(
      payTokenPrice || 0,
    );
    feeTier = fromTokenUsdValue.gte(SWAP_FREE_FEE_MIN_USD)
      ? 'million'
      : fromTokenUsdValue.gte(SWAP_HALF_FEE_MIN_USD)
      ? 'hundredThousand'
      : 'default';
  }
  return { feeRate: RABBY_FEE_TIERS[feeTier], feeTier };
};

export const getRabbyFeeRate = (params: RabbyFeeParams): SwapFeeRate =>
  getRabbyFeeInfo(params).feeRate;
