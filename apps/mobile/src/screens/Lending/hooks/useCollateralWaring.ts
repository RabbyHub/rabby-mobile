import { useMemo } from 'react';
import { useZeroLTVBlockingWithdraw } from './useZeroLTVBlockingWithdraw';
import { valueToBigNumber } from '@aave/math-utils';
import type { FormattedReserveEMode } from '@aave/math-utils/dist/esm/formatters/emode';
import { useLendingSummary } from '../hooks';
import { ReserveDataHumanized } from '@aave/contract-helpers';
import { DisplayPoolReserveInfo } from '../type';
import { useTranslation } from 'react-i18next';

export enum ErrorType {
  DO_NOT_HAVE_SUPPLIES_IN_THIS_CURRENCY,
  CAN_NOT_USE_THIS_CURRENCY_AS_COLLATERAL,
  CAN_NOT_SWITCH_USAGE_AS_COLLATERAL_MODE,
  ZERO_LTV_WITHDRAW_BLOCKED,
  ZERO_LTV_ENABLE_EMODE_FIRST,
}

type ReserveEmodesOnly = {
  eModes?: FormattedReserveEMode[];
};
type ReserveWithEmodes = ReserveDataHumanized & ReserveEmodesOnly;

export const useCollateralWaring = ({
  afterHF,
  userReserve,
  poolReserve,
}: {
  afterHF?: string;
  userReserve: DisplayPoolReserveInfo | null;
  poolReserve?: ReserveWithEmodes;
}) => {
  const assetsBlockingWithdraw = useZeroLTVBlockingWithdraw();
  const { iUserSummary: userSummary } = useLendingSummary();
  const { t } = useTranslation();

  const errorType = useMemo(() => {
    let blockingError: ErrorType | undefined;
    if (!poolReserve || !userReserve || !afterHF) {
      return undefined;
    }
    const reserveEModes =
      poolReserve.eModes ??
      ((userReserve.reserve as unknown as ReserveEmodesOnly).eModes || []);
    const userEMode = reserveEModes.find(
      e => e.id === userSummary?.userEmodeCategoryId,
    );
    const hasNonZeroLtv =
      poolReserve.baseLTVasCollateral !== '0' ||
      (!!userSummary?.userEmodeCategoryId &&
        userEMode?.collateralEnabled &&
        !userEMode?.ltvzeroEnabled);
    const collateralEmodeCategories = reserveEModes.filter(
      e => e.collateralEnabled && !e.ltvzeroEnabled,
    );

    if (
      assetsBlockingWithdraw.length > 0 &&
      !assetsBlockingWithdraw.includes(poolReserve.symbol)
    ) {
      blockingError = ErrorType.ZERO_LTV_WITHDRAW_BLOCKED;
    } else if (valueToBigNumber(userReserve.underlyingBalance).eq(0)) {
      blockingError = ErrorType.DO_NOT_HAVE_SUPPLIES_IN_THIS_CURRENCY;
    } else if (
      !userReserve.usageAsCollateralEnabledOnUser &&
      !hasNonZeroLtv &&
      collateralEmodeCategories.length > 0
    ) {
      blockingError = ErrorType.ZERO_LTV_ENABLE_EMODE_FIRST;
    } else if (
      !userReserve.usageAsCollateralEnabledOnUser &&
      !hasNonZeroLtv &&
      collateralEmodeCategories.length === 0
    ) {
      blockingError = ErrorType.CAN_NOT_USE_THIS_CURRENCY_AS_COLLATERAL;
    } else if (
      userReserve.usageAsCollateralEnabledOnUser &&
      userSummary?.totalBorrowsMarketReferenceCurrency !== '0' &&
      valueToBigNumber(afterHF).lte('1')
    ) {
      blockingError = ErrorType.CAN_NOT_SWITCH_USAGE_AS_COLLATERAL_MODE;
    }
    return blockingError;
  }, [
    afterHF,
    assetsBlockingWithdraw,
    poolReserve,
    userReserve,
    userSummary?.userEmodeCategoryId,
    userSummary?.totalBorrowsMarketReferenceCurrency,
  ]);

  const errorMessage = useMemo(() => {
    switch (errorType) {
      case ErrorType.DO_NOT_HAVE_SUPPLIES_IN_THIS_CURRENCY:
        return t(
          'page.Lending.toggleCollateralModal.toggleRiskTexts.doNotHaveSuppliesInThisCurrency',
        );
      case ErrorType.CAN_NOT_USE_THIS_CURRENCY_AS_COLLATERAL:
        return t(
          'page.Lending.toggleCollateralModal.toggleRiskTexts.canNotUseThisCurrencyAsCollateral',
        );
      case ErrorType.CAN_NOT_SWITCH_USAGE_AS_COLLATERAL_MODE:
        return t(
          'page.Lending.toggleCollateralModal.toggleRiskTexts.canNotSwitchUsageAsCollateralMode',
        );
      case ErrorType.ZERO_LTV_WITHDRAW_BLOCKED:
        return t(
          'page.Lending.toggleCollateralModal.toggleRiskTexts.zeroLTVWithdrawBlocked',
          { assets: assetsBlockingWithdraw.join(', ') },
        );
      case ErrorType.ZERO_LTV_ENABLE_EMODE_FIRST:
        return t(
          'page.Lending.toggleCollateralModal.toggleRiskTexts.zeroLTVEnableEModeFirst',
          { asset: poolReserve?.symbol || userReserve?.reserve.symbol || '' },
        );
      default:
        return null;
    }
  }, [assetsBlockingWithdraw, errorType, poolReserve?.symbol, t, userReserve]);
  return { errorType, errorMessage, isError: !!errorType };
};
