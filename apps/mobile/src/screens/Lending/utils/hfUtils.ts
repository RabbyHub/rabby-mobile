import { ReserveDataHumanized } from '@aave/contract-helpers';
import {
  calculateHealthFactorFromBalancesBigUnits,
  FormatReserveUSDResponse,
  FormatUserSummaryAndIncentivesResponse,
  UserReserveData,
  valueToBigNumber,
} from '@aave/math-utils';
import { BigNumber } from 'bignumber.js';

interface CalculateHFAfterWithdrawProps {
  user: FormatUserSummaryAndIncentivesResponse<
    ReserveDataHumanized & FormatReserveUSDResponse
  >;
  poolReserve: ReserveDataHumanized & FormatReserveUSDResponse;
  userReserve: UserReserveData;
  withdrawAmount: string;
}

export const calculateHFAfterSupply = (
  user: FormatUserSummaryAndIncentivesResponse<
    ReserveDataHumanized & FormatReserveUSDResponse
  >,
  poolReserve: ReserveDataHumanized & FormatReserveUSDResponse,
  supplyAmountInEth: BigNumber,
) => {
  let healthFactorAfterDeposit = user
    ? valueToBigNumber(user.healthFactor)
    : '-1';

  const totalCollateralMarketReferenceCurrencyAfter = user
    ? valueToBigNumber(user.totalCollateralMarketReferenceCurrency).plus(
        supplyAmountInEth,
      )
    : '-1';

  const liquidationThresholdAfter = user
    ? valueToBigNumber(user.totalCollateralMarketReferenceCurrency)
        .multipliedBy(user.currentLiquidationThreshold)
        .plus(
          supplyAmountInEth.multipliedBy(
            poolReserve.formattedReserveLiquidationThreshold,
          ),
        )
        .dividedBy(totalCollateralMarketReferenceCurrencyAfter)
    : '-1';

  if (
    user &&
    ((!user.isInIsolationMode && !poolReserve.isIsolated) ||
      (user.isInIsolationMode &&
        user.isolatedReserve?.underlyingAsset === poolReserve.underlyingAsset))
  ) {
    healthFactorAfterDeposit = calculateHealthFactorFromBalancesBigUnits({
      collateralBalanceMarketReferenceCurrency:
        totalCollateralMarketReferenceCurrencyAfter,
      borrowBalanceMarketReferenceCurrency: valueToBigNumber(
        user.totalBorrowsMarketReferenceCurrency,
      ),
      currentLiquidationThreshold: liquidationThresholdAfter,
    });
  }

  return healthFactorAfterDeposit;
};

export const calculateHFAfterWithdraw = ({
  user,
  userReserve,
  poolReserve,
  withdrawAmount,
}: CalculateHFAfterWithdrawProps) => {
  let totalCollateralInETHAfterWithdraw = valueToBigNumber(
    user.totalCollateralMarketReferenceCurrency,
  );
  let liquidationThresholdAfterWithdraw = user.currentLiquidationThreshold;
  let healthFactorAfterWithdraw = valueToBigNumber(user.healthFactor);

  const userEMode = poolReserve.eModes.find(
    elem => elem.id === user.userEmodeCategoryId,
  );
  const isInEmode = user.userEmodeCategoryId !== 0;

  const reserveLiquidationThreshold =
    isInEmode && userEMode
      ? userEMode.eMode.formattedLiquidationThreshold
      : poolReserve.formattedReserveLiquidationThreshold;

  if (
    userReserve?.usageAsCollateralEnabledOnUser &&
    poolReserve.reserveLiquidationThreshold !== '0'
  ) {
    const amountToWithdrawInEth = valueToBigNumber(withdrawAmount).multipliedBy(
      poolReserve.formattedPriceInMarketReferenceCurrency,
    );
    totalCollateralInETHAfterWithdraw = totalCollateralInETHAfterWithdraw.minus(
      amountToWithdrawInEth,
    );

    liquidationThresholdAfterWithdraw = valueToBigNumber(
      user.totalCollateralMarketReferenceCurrency,
    )
      .multipliedBy(valueToBigNumber(user.currentLiquidationThreshold))
      .minus(
        valueToBigNumber(amountToWithdrawInEth).multipliedBy(
          reserveLiquidationThreshold,
        ),
      )
      .div(totalCollateralInETHAfterWithdraw)
      .toFixed(4, BigNumber.ROUND_DOWN);

    healthFactorAfterWithdraw = calculateHealthFactorFromBalancesBigUnits({
      collateralBalanceMarketReferenceCurrency:
        totalCollateralInETHAfterWithdraw,
      borrowBalanceMarketReferenceCurrency:
        user.totalBorrowsMarketReferenceCurrency,
      currentLiquidationThreshold: liquidationThresholdAfterWithdraw,
    });
  }

  return healthFactorAfterWithdraw;
};
