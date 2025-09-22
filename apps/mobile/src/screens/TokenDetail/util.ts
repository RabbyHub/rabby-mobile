import { getTimeSpan } from '@/utils/time';
import BigNumber from 'bignumber.js';

export const formatPercent = (value: number) => {
  const percentNumber = value * 100;
  const decimalsNumber = Math.min(
    String(percentNumber).split('.')[1]?.length || 0,
    2,
  );
  return `${percentNumber.toFixed(decimalsNumber)}%`;
};
export const formatAmountValueKMB = (
  value: string | number,
  decimals = 2,
): string => {
  const bnValue = new BigNumber(value);

  if (bnValue.lt(0)) {
    return '-';
  }

  const numValue = bnValue.toNumber();
  let formattedValue: string;

  if (numValue >= 1e9) {
    formattedValue = `${(numValue / 1e9).toFixed(2)}B`;
  } else if (numValue >= 1e6) {
    formattedValue = `${(numValue / 1e6).toFixed(2)}M`;
  } else if (numValue >= 1e3) {
    formattedValue = `${(numValue / 1e3).toFixed(2)}K`;
  } else {
    formattedValue = numValue.toFixed(decimals);
  }

  return `${formattedValue}`;
};
export const formatUsdValueKMB = (value: string | number): string => {
  return `$${formatAmountValueKMB(value)}`;
};

// <60s: XX s
// < 60min: XX min
// <24hr: XX hr
// XX day
export const formatTime = (time: number) => {
  const timeElapse = Date.now() / 1000 - time;

  let timeStr = '';
  const { d, h, m, s } = getTimeSpan(timeElapse);

  if (d) {
    timeStr = `${d} day`;
  }
  if (h && !timeStr) {
    timeStr = `${h} hr`;
  }
  if (m && !timeStr) {
    timeStr = `${m} min`;
  }
  if (!timeStr) {
    timeStr = `${s} s`;
  }
  return timeStr;
};
