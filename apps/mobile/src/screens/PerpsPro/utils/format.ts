import { formatNum } from '@/utils/math';
import { PERPS_QUOTE_ASSET_FULL_NAME } from '@/constant/perps';
import BigNumber from 'bignumber.js';

const PERPS_PRO_STABLE_ASSETS = new Set([
  ...Object.keys(PERPS_QUOTE_ASSET_FULL_NAME),
  'USDT0',
]);

export const isPerpsProStableAsset = (asset: string | null | undefined) =>
  PERPS_PRO_STABLE_ASSETS.has(asset?.trim().toUpperCase() ?? '');

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

export const formatPerpsProDecimal = (
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
  return withThousandsSeparators(number.toFixed(decimals));
};

export const formatPerpsProVariableDecimal = (
  value: number | string | null | undefined,
) => {
  if (value == null || value === '') {
    return '-';
  }
  const decimal = new BigNumber(value);
  if (!decimal.isFinite()) {
    return '-';
  }
  return withThousandsSeparators(decimal.toFixed());
};

export const formatPerpsProSignedDecimal = (
  value: number | string | null | undefined,
  decimals = 2,
) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '-';
  }
  const sign = number > 0 ? '+' : '';
  return `${sign}${withThousandsSeparators(number.toFixed(decimals))}`;
};

export const formatPerpsProUsdValue = (
  value: number | string | null | undefined,
  options: { decimals?: number; signed?: boolean } = {},
) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '-';
  }
  const decimals = options.decimals ?? 2;
  const sign = options.signed && number > 0 ? '+' : number < 0 ? '-' : '';
  return `${sign}$${withThousandsSeparators(
    Math.abs(number).toFixed(decimals),
  )}`;
};

export const formatPerpsProTime = (timestamp: number | null | undefined) => {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return '-';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
};
