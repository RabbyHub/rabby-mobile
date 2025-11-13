import BigNumber from 'bignumber.js';

import { formatNetworth } from '@/utils/math';
import { formatPercent, formatUsdValueKMB } from '@/screens/TokenDetail/util';

export const estDaily = (netWorth: string, netApy: number) => {
  if (!netWorth || !netApy) {
    return '--';
  }
  return `${netApy > 0 ? '+' : ''}${formatNetworth(
    BigNumber(netWorth)
      .multipliedBy(BigNumber(netApy))
      .dividedBy(365)
      .toNumber(),
  )}`;
};
export const formatListNetWorth = (num?: number) => {
  if (!num && num !== 0) {
    return '';
  }
  if (num > 1000) {
    return formatUsdValueKMB(num);
  }
  return formatNetworth(num);
};

export const formatApy = (apy: number) => {
  if (!apy) {
    return '0%';
  }
  if (apy < 0.0001) {
    return '<0.01%';
  }
  return formatPercent(apy);
};
