import BigNumber from 'bignumber.js';

import { formatPrice } from '@/utils/number';

export const estDaily = (netWorth: string, netApy: string) => {
  if (!netWorth || !netApy) {
    return '--';
  }
  return `+${formatPrice(
    BigNumber(netWorth)
      .multipliedBy(BigNumber(netApy))
      .dividedBy(365)
      .toNumber(),
  )}`;
};
