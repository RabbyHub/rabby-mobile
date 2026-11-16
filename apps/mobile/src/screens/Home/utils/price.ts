import BigNumber from 'bignumber.js';

export const formatUsdValueKMB = (
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
    formattedValue = `${(numValue / 1e9).toFixed(decimals)}B`;
  } else if (numValue >= 1e6) {
    formattedValue = `${(numValue / 1e6).toFixed(decimals)}M`;
  } else if (numValue >= 1e3) {
    formattedValue = `${(numValue / 1e3).toFixed(decimals)}K`;
  } else {
    formattedValue = numValue.toFixed(2);
  }

  return `$${formattedValue}`;
};

export const formatPercent = (value: number, decimals = 8) => {
  return `${(value * 100).toFixed(decimals)}%`;
};
