import BigNumber from 'bignumber.js';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { convert18RawToTokenRaw } from '@/utils/tempo';

/** Balance in token units. */
export const tokenAmountBn = (token?: TokenItem) =>
  new BigNumber(token?.raw_amount_hex_str || 0, 16).div(
    10 ** (token?.decimals || 0),
  );

export type SliderAmountResult = {
  amount: string;
  useGasPrice: boolean;
};

/**
 * Single source for slider -> amount. Keeps the production rounding and the
 * 100% gas-token deduction in one place.
 */
export const resolveSliderAmount = ({
  balance,
  value,
  isGasToken,
  gasTokenDecimals,
  normalGasPrice,
  gasLimit,
}: {
  balance: BigNumber;
  value: number;
  isGasToken: boolean;
  gasTokenDecimals?: number;
  normalGasPrice?: string | number;
  gasLimit?: number;
}): SliderAmountResult => {
  if (value === 100) {
    const fullAmount = balance;
    let nextAmount = fullAmount.toString(10);
    let useGasPrice = false;
    if (isGasToken && gasTokenDecimals !== undefined && normalGasPrice) {
      const val = fullAmount.minus(
        convert18RawToTokenRaw(
          new BigNumber(gasLimit || 0).times(normalGasPrice),
          gasTokenDecimals,
        ).div(new BigNumber(10).pow(gasTokenDecimals)),
      );
      useGasPrice = !val.lt(0);
      nextAmount = val.lt(0) ? fullAmount.toString(10) : val.toString(10);
    }
    return { amount: nextAmount, useGasPrice };
  }

  const newAmountBn = new BigNumber(value).div(100).times(balance);
  const isTooSmall = newAmountBn.lt(0.0001);
  return {
    amount: isTooSmall
      ? newAmountBn.toString(10)
      : new BigNumber(newAmountBn.toFixed(4, 1)).toString(10),
    useGasPrice: false,
  };
};

/** Single source for amount -> slider (input field -> thumb). */
export const amountToSlider = (amount: string, balance: BigNumber) => {
  if (!amount || !balance.gt(0)) {
    return 0;
  }
  const next = Number(
    new BigNumber(amount || 0).div(balance).times(100).toFixed(0),
  );
  return next < 0 ? 0 : next > 100 ? 100 : next;
};
