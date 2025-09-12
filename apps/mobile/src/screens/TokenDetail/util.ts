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
export const formatAmountValueKMB = (value: string | number): string => {
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
    formattedValue = numValue.toFixed(2);
  }

  return `${formattedValue}`;
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
    timeStr = `${d} day` + (d > 1 ? 's' : '');
  }
  if (h && !timeStr) {
    timeStr = `<${h} hr` + (h > 1 ? 's' : '');
  }
  if (m && !timeStr) {
    timeStr = `<${m} min` + (m > 1 ? 's' : '');
  }
  if (!timeStr) {
    timeStr = `<${s} sec` + (s > 1 ? 's' : '');
  }
  return timeStr;
};
