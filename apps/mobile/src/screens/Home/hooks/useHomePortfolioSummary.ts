import { useMemo } from 'react';
import addressBalanceStore from '@/store/balance';
import { useAddresses24hChangeSummary } from '@/store/balance24h';
import { useHomeDisplayAddresses } from './useHomeDisplayAddresses';

export function useHomePortfolioSummary() {
  const { displayAddresses, isPendingDisplayAddresses } =
    useHomeDisplayAddresses();
  const balanceSummary =
    addressBalanceStore.useAddressesBalanceSummary(displayAddresses);
  const changeSummary = useAddresses24hChangeSummary(displayAddresses);

  const showBalanceLoadingWithoutLocal = useMemo(() => {
    return (
      isPendingDisplayAddresses ||
      (displayAddresses.length > 0 && !balanceSummary.flow.hasAnyValue)
    );
  }, [
    balanceSummary.flow.hasAnyValue,
    displayAddresses.length,
    isPendingDisplayAddresses,
  ]);

  const showChangeLoadingWithoutLocal = useMemo(() => {
    return (
      !showBalanceLoadingWithoutLocal &&
      !changeSummary.combinedData.changePercent &&
      changeSummary.flow.isAnyLoadingWithoutValue &&
      displayAddresses.length > 0
    );
  }, [
    changeSummary.combinedData.changePercent,
    changeSummary.flow.isAnyLoadingWithoutValue,
    displayAddresses.length,
    showBalanceLoadingWithoutLocal,
  ]);

  return useMemo(
    () => ({
      displayAddresses,
      isPendingDisplayAddresses,
      balanceSummary,
      changeSummary,
      totalBalance: balanceSummary.totalBalance,
      showBalanceLoadingWithoutLocal,
      showChangeLoadingWithoutLocal,
    }),
    [
      balanceSummary,
      changeSummary,
      displayAddresses,
      isPendingDisplayAddresses,
      showBalanceLoadingWithoutLocal,
      showChangeLoadingWithoutLocal,
    ],
  );
}
