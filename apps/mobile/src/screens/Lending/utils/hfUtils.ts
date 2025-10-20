import { ReserveDataHumanized } from '@aave/contract-helpers';
import {
  calculateHealthFactorFromBalancesBigUnits,
  FormatReserveUSDResponse,
  FormatUserSummaryAndIncentivesResponse,
  valueToBigNumber,
} from '@aave/math-utils';
import { BigNumber } from 'bignumber.js';

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
