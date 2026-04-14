import { useMemo } from 'react';
import addressBalanceStore from '@/store/balance';
import {
  balance24hStore,
  useAddresses24hChangeSummary,
} from '@/store/balance24h';
import { addressCurve24hStore } from '@/store/curve24h';
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

export function useHomePortfolioRefreshState() {
  const { displayAddresses } = useHomeDisplayAddresses();
  const balanceSnapshots =
    addressBalanceStore.useAddressesSnapshot(displayAddresses);
  const balance24hSnapshots =
    balance24hStore.useAddresses24hBalanceSnapshots(displayAddresses);
  const curveSnapshots = addressCurve24hStore.useSnapshots(displayAddresses);

  const isBalanceFetchingRemote = useMemo(() => {
    return balanceSnapshots.some(item => item.flow.isFetchingRemote);
  }, [balanceSnapshots]);

  const is24hChangeFetchingRemote = useMemo(() => {
    return balance24hSnapshots.some(item => item.flow.isFetchingRemote);
  }, [balance24hSnapshots]);

  const isCurveFetchingRemote = useMemo(() => {
    return curveSnapshots.some(item => item.flow.isFetchingRemote);
  }, [curveSnapshots]);

  return useMemo(
    () => ({
      displayAddresses,
      isBalanceFetchingRemote,
      is24hChangeFetchingRemote,
      isCurveFetchingRemote,
      isAnyRemoteRefreshing:
        isBalanceFetchingRemote ||
        is24hChangeFetchingRemote ||
        isCurveFetchingRemote,
    }),
    [
      displayAddresses,
      is24hChangeFetchingRemote,
      isBalanceFetchingRemote,
      isCurveFetchingRemote,
    ],
  );
}
