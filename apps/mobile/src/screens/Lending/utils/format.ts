import BigNumber from 'bignumber.js';

import { formatPrice } from '@/utils/number';

export const estDaily = (netWorth: string, netApy: number) => {
  if (!netWorth || !netApy) {
    return '--';
  }
  return `${netApy > 0 ? '+' : ''}${formatPrice(
    BigNumber(netWorth)
      .multipliedBy(BigNumber(netApy))
      .dividedBy(365)
      .toNumber(),
  )}`;
};
