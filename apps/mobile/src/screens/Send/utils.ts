import BigNumber from 'bignumber.js';

import { formatTokenAmount, formatUsdValue } from '@/utils/number';

function getSafeSendAmountBn(amount?: string | number | BigNumber | null) {
  const bn = new BigNumber(amount || 0);
  return bn.isFinite() && !bn.isNaN() ? bn : new BigNumber(0);
}

function formatFixedUsdAmountText(value: BigNumber) {
  const fixedValue = value.toFixed(2);
  const [intPart, decimalPart] = fixedValue.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const absIntPart = sign ? intPart.slice(1) : intPart;
  const groupedIntPart = absIntPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${sign}${groupedIntPart}.${decimalPart || '00'}`;
}

export function formatSendTokenBalanceText(
  value: string | number | BigNumber | null | undefined,
  decimalPlaces: number,
) {
  const balance = getSafeSendAmountBn(value);
  const flooredBalance = balance.toFixed(decimalPlaces, BigNumber.ROUND_FLOOR);
  const displayBalance =
    balance.gt(0) && new BigNumber(flooredBalance).isZero()
      ? balance.toFixed()
      : flooredBalance;

  return formatTokenAmount(displayBalance, decimalPlaces);
}

export function formatSendUsdValueText(
  value: string | number | BigNumber | null | undefined,
) {
  const bn = getSafeSendAmountBn(value);

  if (bn.isZero()) {
    return '$0';
  }
  if (bn.lt(0.01)) {
    return formatUsdValue(bn.toString(10), 2);
  }

  return `$${formatFixedUsdAmountText(bn)}`;
}
