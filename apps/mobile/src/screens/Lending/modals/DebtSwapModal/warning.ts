import BigNumber from 'bignumber.js';
import { SwappableToken } from '../../types/swap';

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
  //TODO: 上线前删掉 测试环境，降低确认阈值
  return true;
  //if (srcValueInUsd > 500000) {
  //  return lostValue > 0.03;
  //}
  //if (srcValueInUsd > 100000) {
  //  return lostValue > 0.04;
  //}
  //if (srcValueInUsd > 10000) {
  //  return lostValue > 0.05;
  //}
  //if (srcValueInUsd > 1000) {
  //  return lostValue > 0.07;
  //}

  //return lostValue > 0.05;
};

export const shouldRequireConfirmation = (lostValue: number) => {
  //TODO: 上线前删掉 测试环境，降低确认阈值
  return lostValue > 0.0002;
  //return lostValue > 0.2;
};

export const getPriceImpactData = ({
  fromToken,
  toToken,
  fromAmount,
  toAmount,
}: {
  fromToken: SwappableToken;
  toToken?: SwappableToken;
  fromAmount: string;
  toAmount: string;
}) => {
  if (!fromToken || !toToken || !fromAmount || !toAmount) {
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
