import BigNumber from 'bignumber.js';

// Presentation only. Never feed rounded PnL/ROI back into the order price.
export const formatPositionTpSlMagnitude = (value: string | null) => {
  const decimal = new BigNumber(value ?? Number.NaN);
  return decimal.isFinite()
    ? decimal.abs().decimalPlaces(2, BigNumber.ROUND_HALF_UP).toFixed()
    : '';
};

export const formatPositionTpSlSignedValue = (value: string | null) => {
  const decimal = new BigNumber(value ?? Number.NaN);
  if (!decimal.isFinite()) return '-';
  const sign = decimal.gt(0) ? '+' : decimal.lt(0) ? '-' : '';
  return `${sign}${decimal.abs().toFormat(2, BigNumber.ROUND_HALF_UP, {
    groupSeparator: ',',
    groupSize: 3,
    decimalSeparator: '.',
  })}`;
};
