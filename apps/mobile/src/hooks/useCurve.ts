import { CurveDayType } from '@/utils/curveDayType';
import { useMemo } from 'react';
import { balance24hStore } from '@/store/balance24h';
import { addressCurve24hStore } from '@/store/curve24h';
import { apisAddressBalance } from './useCurrentBalance';
import {
  CurveList,
  CurvePoint,
  formChartData,
  formatSmallCurrencyValue,
  formatSmallUsdValue,
  makeDefaultSelectData,
} from '@/store/curveShared';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  getAddressCurveProjection,
  type AddressCurveProjectionOptions,
} from './addressCurveProjection';

export {
  formChartData,
  formatSmallCurrencyValue,
  formatSmallUsdValue,
  makeDefaultSelectData,
};
export type { CurveList, CurvePoint };

const EMPTY_CURVE_LIST: CurveList = [];

function lcAddr(address?: string) {
  return address?.toLowerCase() || '';
}

export function useIsLoadingCurve(address?: string) {
  const normalizedAddress = lcAddr(address);
  const isLoadingCurve = useActivityStore(
    addressCurve24hStore.useStore,
    state => {
      const meta = state.metaMap[normalizedAddress];
      return !!meta?.isHydrating || !!meta?.isFetchingRemote;
    },
    Object.is,
    { storeLabel: 'address-curve-24h' },
  );

  return {
    isLoadingCurve,
  };
}

export function useAddressCurveSelectData(
  address?: string,
  options?: AddressCurveProjectionOptions,
) {
  const normalizedAddress = lcAddr(address);
  const curveList = useActivityStore(
    addressCurve24hStore.useStore,
    state => state.valueMap[normalizedAddress],
    Object.is,
    { storeLabel: 'address-curve-24h' },
  );

  return useMemo(() => {
    return getAddressCurveProjection(curveList, {
      realtimeNetWorth: options?.realtimeNetWorth,
      staticBalance: options?.staticBalance,
      baseUsdValue: options?.baseUsdValue,
      type: options?.type,
    });
  }, [
    curveList,
    options?.baseUsdValue,
    options?.realtimeNetWorth,
    options?.staticBalance,
    options?.type,
  ]);
}

export function warmupCurveForAddress(
  addr: string,
  options?: {
    realtimeNetWorth?: number | null;
    staticBalance?: number | null;
    force?: boolean;
    days?: CurveDayType;
  },
) {
  const days = options?.days ?? CurveDayType.DAY;
  if (days !== CurveDayType.DAY) {
    return Promise.resolve(undefined);
  }

  return addressCurve24hStore.warmupAddressCurve(addr, {
    force: options?.force ?? true,
    trace: {
      scene: 'SingleAddress',
      requester: 'useCurve.warmupCurveForAddress',
      endpoint: 'openapi.getNetCurve',
    },
  });
}

export function useCurveDataByAddress(address: string) {
  const lowerAddress = lcAddr(address);
  const curveList =
    addressCurve24hStore.useAddressCurve(lowerAddress) ?? EMPTY_CURVE_LIST;
  const flow = addressCurve24hStore.useAddressCurveFlowState(lowerAddress);
  const meta = addressCurve24hStore.useAddressResourceState(lowerAddress);
  const balanceState = apisAddressBalance.getBalanceState(lowerAddress);
  const baseUsdValue =
    balance24hStore.getAddress24hBalance(lowerAddress)?.total_usd_value;
  const selectData = useAddressCurveSelectData(lowerAddress, {
    realtimeNetWorth: balanceState?.evmBalance ?? 0,
    staticBalance: balanceState?.balance ?? 0,
    baseUsdValue,
  });

  return {
    curveState: {
      curveList,
      loadedFromApi: meta?.sourceOfCurrentValue === 'remote',
      updateTime: meta?.lastRemoteAt || meta?.lastHydratedAt || 0,
      loadingCurve: flow.isLoading,
      selectData,
      isDecrease: selectData.isLoss,
    },
  };
}
