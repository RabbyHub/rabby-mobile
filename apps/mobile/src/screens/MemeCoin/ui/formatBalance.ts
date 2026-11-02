import BigNumber from 'bignumber.js';
import { formatUsdValue } from '@/utils/number';

const WHOLE_DOLLARS_ABOVE_USD = 50;

/** For the wallet entry and the balance card: above $50 the cents are cut, not rounded. */
export const formatMemeBalanceUsd = (usd: number) =>
  usd > WHOLE_DOLLARS_ABOVE_USD
    ? `$${new BigNumber(usd).integerValue(BigNumber.ROUND_DOWN).toFormat(0)}`
    : formatUsdValue(usd);
