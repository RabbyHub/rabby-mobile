import { useMemo } from 'react';
import { useLendingISummary, useSelectedMarket } from '../hooks';
import { hasNonZeroEffectiveLtv } from '../utils/hfUtils';

export const useZeroLTVBlockingWithdraw = () => {
  const { iUserSummary: userSummary } = useLendingISummary();
  const { selectedMarketData } = useSelectedMarket();

  return useMemo(() => {
    if (
      !selectedMarketData?.v3 ||
      !userSummary ||
      userSummary.totalBorrowsUSD === '0'
    ) {
      return [];
    }

    const zeroLTVBlockingWithdraw: string[] = [];
    userSummary.userReservesData.forEach(userReserve => {
      const emodeEntry = userReserve.reserve.eModes.find(
        e => e.id === userSummary.userEmodeCategoryId,
      );
      const hasEffectiveLtv = hasNonZeroEffectiveLtv({
        baseLTVasCollateral: userReserve.reserve.baseLTVasCollateral,
        isInEmode: userSummary.userEmodeCategoryId !== 0,
        emodeEntry,
        isEModeIsolated: !!emodeEntry?.eMode.isolated,
      });

      if (
        Number(userReserve.scaledATokenBalance) > 0 &&
        !hasEffectiveLtv &&
        userReserve.usageAsCollateralEnabledOnUser &&
        userReserve.reserve.reserveLiquidationThreshold !== '0'
      ) {
        zeroLTVBlockingWithdraw.push(userReserve.reserve.symbol);
      }
    });

    return zeroLTVBlockingWithdraw;
  }, [selectedMarketData?.v3, userSummary]);
};
