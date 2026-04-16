import BigNumber from 'bignumber.js';
import { SwappableToken } from '../../types/swap';
import { valueToBigNumber } from '@aave/math-utils';

export const valueLostPercentage = (
  destValueInUsd: number,
  srcValueInUsd: number,
) => {
  if (destValueInUsd === 0) {
    return 1;
  }
  if (srcValueInUsd === 0) {
    return 0;
  }

  const receivingPercentage = destValueInUsd / srcValueInUsd;
  return receivingPercentage ? 1 - receivingPercentage : 0;
};

export const shouldShowWarning = (lostValue: number, srcValueInUsd: number) => {
  if (srcValueInUsd > 500000) {
    return lostValue > 0.03;
  }
  if (srcValueInUsd > 100000) {
    return lostValue > 0.04;
  }
  if (srcValueInUsd > 10000) {
    return lostValue > 0.05;
  }
  if (srcValueInUsd > 1000) {
    return lostValue > 0.07;
  }

  return lostValue > 0.05;
};

export const shouldRequireConfirmation = (lostValue: number) => {
  return lostValue > 0.2;
};

export const getPriceImpactData = ({
  fromToken,
  toToken,
  fromAmount,
  toAmount,
}: {
  fromToken?: SwappableToken;
  toToken?: SwappableToken;
  fromAmount: string;
  toAmount: string;
}) => {
  if (!fromToken || !toToken || !Number(fromAmount) || !Number(toAmount)) {
    return {
      showWarning: false,
      showConfirmation: false,
      lostValue: 0,
      diff: 0,
    };
  }
  const pay = new BigNumber(fromAmount || 0).times(fromToken.usdPrice || 0);
  const receive = new BigNumber(toAmount || 0).times(toToken.usdPrice || 0);
  const lostValue = valueLostPercentage(pay.toNumber(), receive.toNumber());
  const showWarning = shouldShowWarning(lostValue, receive.toNumber());
  const showConfirmation = shouldRequireConfirmation(lostValue);
  return {
    showWarning,
    showConfirmation,
    lostValue,
    diff: lostValue.toFixed(2),
  };
};

export const getToAmountAfterSlippage = ({
  inputAmount,
  slippage,
}: {
  inputAmount: string; // to，目标债务
  slippage: number; // bps
}) => {
  return valueToBigNumber(inputAmount)
    .multipliedBy(1 + Number(slippage) / 10000)
    .toFixed();
};

// generate signature approval a certain threshold above the current balance to account for accrued interest
export const SIGNATURE_AMOUNT_MARGIN = 0.1;
export const SIGNATURE_AMOUNT_MARGIN_HIGH = 0.25;

// Calculate aToken amount to request for signature, adding small margin to account for accruing interest
export const calculateSignedAmount = (amount: string, margin?: number) => {
  const amountBN = valueToBigNumber(amount);
  const marginBN = valueToBigNumber(margin ?? SIGNATURE_AMOUNT_MARGIN);
  const amountWithMargin = amountBN.plus(amountBN.multipliedBy(marginBN));
  return amountWithMargin.toFixed(0);
};

export const getApproveAmount = (amount: string, slippage: number) => {
  const repeatAfterSlippage = getToAmountAfterSlippage({
    inputAmount: amount,
    slippage: Number(slippage || 0) * 100, // 为了和aave保持一致写的，有可能是多授权了
  });
  return calculateSignedAmount(
    repeatAfterSlippage,
    SIGNATURE_AMOUNT_MARGIN_HIGH,
  );
};
