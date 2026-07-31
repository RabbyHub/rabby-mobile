import { formatNum } from '@/utils/math';

const withThousandsSeparators = (value: string) => {
  const [integer, fraction] = value.split('.');
  const formattedInteger = integer?.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  return fraction ? `${formattedInteger}.${fraction}` : formattedInteger;
};

export const formatPerpsProCompactNumber = (
  value: number | string | null | undefined,
  decimals = 2,
) => {
  if (value == null || value === '') {
    return '-';
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '-';
  }
  return formatNum(number, decimals, {
    abbrStart: 1,
    floor: false,
    trimFractionZero: false,
  });
};

export const formatPerpsProPrice = (
  value: number | string | null | undefined,
  decimals?: number,
) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return '-';
  }
  const resolvedDecimals =
    decimals ??
    (number >= 1000 ? 1 : number >= 1 ? 2 : Math.min(8, Math.max(2, 4)));
  return withThousandsSeparators(number.toFixed(resolvedDecimals));
};

export const formatPerpsProPercent = (
  value: number | null | undefined,
  decimals = 2,
  includePlus = true,
) => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  const percent = value * 100;
  const sign = includePlus && percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(decimals)}%`;
};

export const formatPerpsProFundingRate = (
  value: number | string | null | undefined,
  decimals = 5,
) => {
  const rate = Number(value);
  return Number.isFinite(rate) ? `${(rate * 100).toFixed(decimals)}%` : '-';
};

export const formatPerpsProSignedUsd = (
  value: number | null | undefined,
  decimals = 4,
) => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(decimals)}`;
};
