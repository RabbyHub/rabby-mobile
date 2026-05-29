import { USD_CURRENCY } from '@/constant/currency';
import {
  formatNumber,
  formatTokenAmount,
  splitNumberByStep,
} from '@/utils/number';
import type { CurrencyItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';

export type CurrencyValueParts = {
  text: string;
  amountText: string;
  symbol: string;
  isPrefix: boolean;
};

type CurrencyFormatOptions = {
  decimal?: number;
  formatMillion?: boolean;
  currency?: CurrencyItem;
};

export const isCurrencyPrefix = (currency?: Pick<CurrencyItem, 'is_prefix'>) =>
  currency?.is_prefix !== false;

const joinCurrencyValueParts = (
  amountText: string,
  options: {
    currency: CurrencyItem;
    sign?: string;
    lessThan?: boolean;
  },
): CurrencyValueParts => {
  const { currency, sign = '', lessThan = false } = options;
  const symbol = currency.symbol;
  const isPrefix = isCurrencyPrefix(currency);
  const amountPrefix = `${lessThan ? '<' : ''}${sign}`;
  const prefixedAmount = `${amountPrefix}${amountText}`;

  return {
    text: isPrefix
      ? `${amountPrefix}${symbol}${amountText}`
      : `${prefixedAmount} ${symbol}`,
    amountText: prefixedAmount,
    symbol,
    isPrefix,
  };
};

const formatPostfixCurrencyAmount = (value: BigNumber) => {
  const absValue = value.absoluteValue();

  if (absValue.isZero() || absValue.isNaN()) {
    return '0';
  }

  return formatTokenAmount(absValue.toFixed());
};

const formatPostfixCurrencyValueParts = (
  value: BigNumber,
  currency: CurrencyItem,
): CurrencyValueParts => {
  const sign = value.lt(0) ? '-' : '';

  return joinCurrencyValueParts(formatPostfixCurrencyAmount(value), {
    currency,
    sign,
  });
};

export const formatCurrencyValueParts = (
  value: string | number,
  options?: CurrencyFormatOptions,
): CurrencyValueParts => {
  const { decimal, formatMillion, currency = USD_CURRENCY } = options || {};
  const bnValue = new BigNumber(value).times(currency.usd_rate);

  if (!isCurrencyPrefix(currency) && decimal === undefined) {
    return formatPostfixCurrencyValueParts(bnValue, currency);
  }

  if (bnValue.lt(0)) {
    return joinCurrencyValueParts(
      formatNumber(bnValue.absoluteValue(), decimal, {}, formatMillion),
      {
        currency,
        sign: '-',
      },
    );
  }

  if (bnValue.gte(0.01) || bnValue.eq(0)) {
    return joinCurrencyValueParts(
      formatNumber(bnValue, decimal, {}, formatMillion),
      {
        currency,
      },
    );
  }

  return joinCurrencyValueParts('0.01', {
    currency,
    lessThan: true,
  });
};

export const formatSmallCurrencyValueParts = (
  value: number,
  options?: {
    currency?: CurrencyItem;
  },
): CurrencyValueParts => {
  const { currency = USD_CURRENCY } = options || {};
  const val = new BigNumber(value).times(currency.usd_rate);

  if (!isCurrencyPrefix(currency)) {
    return formatPostfixCurrencyValueParts(val, currency);
  }

  if (val.isZero() || val.isNaN()) {
    return joinCurrencyValueParts('0', { currency });
  }

  if (val.isLessThan(0.01)) {
    return joinCurrencyValueParts('0.01', {
      currency,
      lessThan: true,
    });
  }

  if (val.isLessThanOrEqualTo(10)) {
    return joinCurrencyValueParts(splitNumberByStep(val.toFixed(2)), {
      currency,
    });
  }

  return formatCurrencyValueParts(value, {
    decimal: 2,
    formatMillion: true,
    currency,
  });
};
