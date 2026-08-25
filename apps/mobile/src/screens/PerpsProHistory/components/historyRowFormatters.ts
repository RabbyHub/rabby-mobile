import BigNumber from 'bignumber.js';

import {
  formatPerpsProDecimal,
  formatPerpsProPrice,
  isPerpsProStableAsset,
} from '@/screens/PerpsPro/utils/format';

export type PerpsProHistoryTone = 'info' | 'negative' | 'neutral' | 'positive';

export const titleCasePerpsProHistoryValue = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .replace(/\b\w/gu, character => character.toUpperCase());

export const getPerpsProHistorySignedTone = (
  value: string,
): PerpsProHistoryTone => {
  const decimal = new BigNumber(value || 0);
  if (!decimal.isFinite() || decimal.isZero()) {
    return 'neutral';
  }
  return decimal.gt(0) ? 'positive' : 'negative';
};

export const formatPerpsProHistoryAmount = (
  value: string | null,
  maximumDecimals: number,
) => {
  const decimal = new BigNumber(value ?? Number.NaN);
  if (!decimal.isFinite()) {
    return '-';
  }
  const decimals = Math.min(
    maximumDecimals,
    Math.max(0, decimal.decimalPlaces() ?? 0),
  );
  return formatPerpsProDecimal(decimal.toString(), decimals);
};

export const formatPerpsProHistoryAssetAmount = (
  value: string | null,
  asset: string,
  maximumDecimals: number,
) =>
  isPerpsProStableAsset(asset)
    ? formatPerpsProDecimal(value, 2)
    : formatPerpsProHistoryAmount(value, maximumDecimals);

export const formatPerpsProOrderHistoryPrice = (
  value: string | null,
  maximumDecimals?: number,
) => {
  const formatted = formatPerpsProPrice(value, maximumDecimals);
  if (formatted === '-') {
    return formatted;
  }
  const [integer, fraction = ''] = formatted.split('.');
  const trimmedFraction = fraction.replace(/0+$/u, '').padEnd(2, '0');
  return `${integer}.${trimmedFraction}`;
};
