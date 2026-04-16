import { useEffect, useMemo, useRef, useState } from 'react';
import { SwappableToken, SwapType } from '../../../types/swap';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useLendingSummary } from '../../../hooks';
import { constants } from 'ethers';
import BigNumber from 'bignumber.js';
import {
  DEFAULT_DEBT_SWAP_SLIPPAGE,
  getParaswapSlippage,
  maxInputAmountWithSlippage,
} from '../../../modals/DebtSwapModal/utils';
import { OptimalRate } from '@paraswap/sdk';
import { calculateHFAfterCollateralRepay } from '../../../utils/hfUtils';
import { valueToBigNumber } from '@aave/math-utils';
import {
  LIQUIDATION_DANGER_THRESHOLD,
  LIQUIDATION_SAFETY_THRESHOLD,
} from '../../../utils/constant';

export const useFormatValues = ({
  collateralToken, // 用户选择的抵押物
  repayToken, // 目标偿还的债务
  collateralAmount,
  repayAmount,
}: {
  collateralToken?: SwappableToken;
  repayToken: SwappableToken;
  collateralAmount: string;
  repayAmount: string;
}) => {
  const debtBalance = useMemo(() => {
    return new BigNumber(repayToken?.balance || 0);
  }, [repayToken]);

  const debtBalanceToDisplay = useMemo(() => {
    return formatTokenAmount(debtBalance.toString(10));
  }, [debtBalance]);

  const debtUsdValue = useMemo(() => {
    const usdPrice = new BigNumber(repayToken?.usdPrice || 0);
    return formatUsdValue(
      new BigNumber(repayAmount || 0).times(usdPrice).toString(10),
    );
  }, [repayAmount, repayToken?.usdPrice]);

  const collateralUsdValue = useMemo(() => {
    if (!collateralToken) {
      return formatUsdValue(0);
    }
    const usdPrice = new BigNumber(collateralToken?.usdPrice || 0);
    return formatUsdValue(
      new BigNumber(collateralAmount || 0).times(usdPrice).toString(10),
    );
  }, [collateralAmount, collateralToken]);

  return {
    collateralUsdValue,
    debtBalanceToDisplay,
    debtUsdValue,
    debtBalance,
  };
};

export const useSwapReserves = ({
  collateralToken,
  repayToken,
}: {
  collateralToken?: SwappableToken;
  repayToken: SwappableToken;
}) => {
  const { formattedPoolReservesAndIncentives, displayPoolReserves } =
    useLendingSummary();
  const collateralReserve = useMemo(() => {
    if (!collateralToken?.underlyingAddress) {
      return undefined;
    }
    return formattedPoolReservesAndIncentives?.find(item =>
      isSameAddress(item.underlyingAsset, collateralToken?.underlyingAddress),
    );
  }, [formattedPoolReservesAndIncentives, collateralToken?.underlyingAddress]);

  const repayReserve = useMemo(
    () =>
      formattedPoolReservesAndIncentives?.find(item =>
        isSameAddress(
          item.underlyingAsset,
          repayToken?.underlyingAddress || constants.AddressZero,
        ),
      ),
    [formattedPoolReservesAndIncentives, repayToken?.underlyingAddress],
  );
  const repayDisplayReserve = useMemo(() => {
    if (!repayToken?.underlyingAddress) {
      return undefined;
    }
    return displayPoolReserves.find(item =>
      isSameAddress(item.underlyingAsset, repayToken?.underlyingAddress),
    );
  }, [displayPoolReserves, repayToken?.underlyingAddress]);

  const collateralDisplayReserve = useMemo(() => {
    if (!collateralToken?.underlyingAddress) {
      return undefined;
    }
    return displayPoolReserves.find(item =>
      isSameAddress(item.underlyingAsset, collateralToken.underlyingAddress),
    );
  }, [displayPoolReserves, collateralToken?.underlyingAddress]);

  const isSameToken = useMemo(() => {
    if (!repayToken || !collateralToken?.underlyingAddress) {
      return false;
    }
    return isSameAddress(
      repayToken.underlyingAddress,
      collateralToken?.underlyingAddress,
    );
  }, [collateralToken?.underlyingAddress, repayToken]);
  return {
    collateralReserve,
    repayReserve,
    isSameToken,
    repayDisplayReserve,
    collateralDisplayReserve,
  };
};

export const useRepayWithCollateralSlippage = ({
  collateralToken,
  repayToken,
  setSwapRate,
}: {
  collateralToken?: SwappableToken;
  repayToken: SwappableToken;
  setSwapRate: React.Dispatch<
    React.SetStateAction<{
      optimalRateData?: OptimalRate;
      inputAmount?: string;
      outputAmount?: string;
      slippageBps?: number;
      maxInputAmountWithSlippage?: string;
    }>
  >;
}) => {
  const [slippage, setSlippage] = useState<string>(
    new BigNumber(DEFAULT_DEBT_SWAP_SLIPPAGE).div(100).toString(10),
  );
  const [autoSlippage, setAutoSlippage] = useState(true);

  const [isCustomSlippage, setIsCustomSlippage] = useState(false);
  const recommendedSlippageBps = useMemo(() => {
    if (!collateralToken) {
      return DEFAULT_DEBT_SWAP_SLIPPAGE;
    }
    return getParaswapSlippage(
      collateralToken.symbol || '',
      repayToken.symbol || '',
      SwapType.RepayWithCollateral,
    );
  }, [collateralToken, repayToken.symbol]);

  const displaySlippage = useMemo(() => {
    const value = autoSlippage
      ? recommendedSlippageBps
      : new BigNumber(slippage || 0).times(100).toNumber();
    return new BigNumber(value || DEFAULT_DEBT_SWAP_SLIPPAGE)
      .div(100)
      .toString(10);
  }, [autoSlippage, recommendedSlippageBps, slippage]);

  const selectedSlippageBps = useMemo(() => {
    if (autoSlippage) {
      return recommendedSlippageBps || DEFAULT_DEBT_SWAP_SLIPPAGE;
    }
    const bps = new BigNumber(slippage || 0)
      .times(100)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toNumber();
    const clamped = Math.min(Math.max(bps, 10), 5000);
    return clamped || DEFAULT_DEBT_SWAP_SLIPPAGE;
  }, [autoSlippage, recommendedSlippageBps, slippage]);

  useEffect(() => {
    if (autoSlippage) {
      setSlippage(
        new BigNumber(recommendedSlippageBps || DEFAULT_DEBT_SWAP_SLIPPAGE)
          .div(100)
          .toString(10),
      );
      setIsCustomSlippage(false);
    }
  }, [autoSlippage, recommendedSlippageBps]);

  const slippageBpsRef = useRef(selectedSlippageBps);

  useEffect(() => {
    slippageBpsRef.current = selectedSlippageBps;
  }, [selectedSlippageBps]);

  useEffect(() => {
    setSwapRate(prev => {
      if (!prev.optimalRateData && !prev.inputAmount) {
        return prev;
      }
      const amountForMax =
        prev.inputAmount || prev.optimalRateData?.srcAmount || '0';
      const nextMaxInput = maxInputAmountWithSlippage(
        amountForMax,
        selectedSlippageBps,
      );
      if (
        prev.slippageBps === selectedSlippageBps &&
        prev.maxInputAmountWithSlippage === nextMaxInput
      ) {
        return prev;
      }
      return {
        ...prev,
        slippageBps: selectedSlippageBps,
        maxInputAmountWithSlippage: nextMaxInput,
      };
    });
  }, [selectedSlippageBps, setSwapRate]);

  return {
    slippage,
    setSlippage,
    autoSlippage,
    setAutoSlippage,
    isCustomSlippage,
    setIsCustomSlippage,
    displaySlippage,
    selectedSlippageBps,
    slippageBpsRef,
  };
};

export const useHFForRepayWithCollateral = ({
  collateralToken,
  repayToken,
  collateralAmount,
  repayAmount,
}: {
  collateralToken?: SwappableToken;
  repayToken: SwappableToken;
  collateralAmount: string;
  repayAmount: string;
}) => {
  const { iUserSummary: user } = useLendingSummary();
  const {
    collateralReserve,
    collateralDisplayReserve,
    repayReserve,
    repayDisplayReserve,
  } = useSwapReserves({
    collateralToken,
    repayToken,
  });
  const afterSwapInfo = useMemo(() => {
    if (
      !collateralDisplayReserve ||
      !repayDisplayReserve ||
      !collateralReserve ||
      !repayReserve ||
      !user ||
      !collateralToken
    ) {
      return undefined;
    }
    return calculateHFAfterCollateralRepay({
      amountToReceiveAfterSwap: repayAmount ?? '0',
      amountToSwap: collateralAmount ?? '0',
      fromAssetData: collateralReserve, // used as collateral
      user,
      toAssetData: repayReserve,
      repayWithUserReserve: collateralDisplayReserve,
      debt: repayDisplayReserve.variableBorrows ?? '0',
    });
  }, [
    collateralDisplayReserve,
    repayDisplayReserve,
    collateralReserve,
    repayReserve,
    user,
    collateralToken,
    collateralAmount,
    repayAmount,
  ]);

  const isHFLow = useMemo(() => {
    const hfAfterSwap = afterSwapInfo?.hfAfterSwap;
    if (!hfAfterSwap) {
      return false;
    }

    const hfNumber = valueToBigNumber(hfAfterSwap);

    if (hfNumber.lt(0)) {
      return false;
    }

    return (
      hfNumber.lt(LIQUIDATION_SAFETY_THRESHOLD) &&
      hfNumber.gte(LIQUIDATION_DANGER_THRESHOLD)
    );
  }, [afterSwapInfo?.hfAfterSwap]);

  const isLiquidatable = useMemo(() => {
    const hfAfterSwap = afterSwapInfo?.hfAfterSwap;
    if (!hfAfterSwap) {
      return false;
    }

    const hfNumber = valueToBigNumber(hfAfterSwap);

    if (hfNumber.lt(0)) {
      return false;
    }
    return valueToBigNumber(afterSwapInfo.hfAfterSwap).lt(
      LIQUIDATION_DANGER_THRESHOLD,
    );
  }, [afterSwapInfo?.hfAfterSwap]);

  return {
    currentHF: user?.healthFactor,
    afterSwapInfo,
    isHFLow,
    isLiquidatable,
  };
};
