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
  const flow = addressCurve24hStore.useAddressCurveFlowState(address);

  return {
    isLoadingCurve: flow.isLoading,
  };
}

type AddressCurveSelectOptions = {
  realtimeNetWorth?: number | null;
  staticBalance?: number | null;
  baseUsdValue?: number | null;
  type?: CurveDayType;
};

export function useAddressCurveSelectData(
  address?: string,
  options?: AddressCurveSelectOptions,
) {
  const curveList = addressCurve24hStore.useAddressCurve(address);

  return useMemo(() => {
    const normalizedCurveList = curveList ?? EMPTY_CURVE_LIST;

    if (!normalizedCurveList.length) {
      return makeDefaultSelectData();
    }

    return formChartData(normalizedCurveList, {
      realtimeNetWorth: options?.realtimeNetWorth ?? 0,
      realtimeTimestamp: Date.now(),
      type: options?.type ?? CurveDayType.DAY,
      staticBalance: options?.staticBalance ?? 0,
      baseUsdValue: options?.baseUsdValue,
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
