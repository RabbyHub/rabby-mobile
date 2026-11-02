import BigNumber from 'bignumber.js';
import { formatUsdValue } from '@/utils/number';

const WHOLE_DOLLARS_ABOVE_USD = 50;

/**
 * For the wallet entry and the balance card: above $50 the cents are cut, not
 * rounded, and a balance that would read $0.00 shows $0.
 */
export const formatMemeBalanceUsd = (usd: number) => {
  if (usd > WHOLE_DOLLARS_ABOVE_USD) {
    return `$${new BigNumber(usd)
      .integerValue(BigNumber.ROUND_DOWN)
      .toFormat(0)}`;
  }
  const text = formatUsdValue(usd);
  return text === '$0.00' ? '$0' : text;
};

/** +$200.32 / -$3.10; zero counts as a gain */
export const formatMemePnlUsd = (usd: number) =>
  `${usd < 0 ? '' : '+'}${formatUsdValue(usd)}`;
