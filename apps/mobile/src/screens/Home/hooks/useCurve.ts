import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { useCurve } from '@/hooks/useCurve';
import { numFormat } from '@/utils/math';
import { formatUsdValue } from '@/utils/number';
import dayjs from 'dayjs';
import { findLastIndex } from 'lodash';
import { useEffect, useState } from 'react';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';

export const use24hCurveData = () => {
  const { currentAccount } = useCurrentAccount();
  const { balance, success, hasValueChainBalances, balanceLoading } =
    useCurrentBalance(currentAccount?.address);

  const {
    result: curveData,
    refresh: refreshCurve,
    isLoading: curveLoading,
  } = useCurve(currentAccount?.address, 0, balance);

  return {
    curveData,
    curveLoading,
    balanceLoading,
    refreshCurve,
    success,
    hasValueChainBalances,
    hadAssets:
      hasValueChainBalances.length > 0 &&
      success &&
      !balanceLoading &&
      currentAccount !== null &&
      !curveLoading,

    isOffline: !curveLoading && !balanceLoading && !success,
  };
};

type CurveList = Array<[number, number]>;

type AssetsCurve = {
  usd_value_list: CurveList;
};

export type CurvePoint = {
  value: number;
  netWorth: string;
  change: string;
  isLoss: boolean;
  changePercent: string;
  timestamp: number;
  dateString: string;
};

export const formatTimeMachineCurve = (range: number[], data?: AssetsCurve) => {
  let isEmptyAssets = true;

  if (!data?.usd_value_list?.length) {
    return {
      list: [] as CurvePoint[],
      isEmptyAssets: true,
    };
  }

  const startIdx = data.usd_value_list.findIndex(([time]) => time >= range[0]);
  const endIdx = findLastIndex(
    data.usd_value_list,
    ([time]) => time <= range[1],
  );
  const list = data.usd_value_list.slice(startIdx, endIdx + 1);

  if (!list?.length) {
    return {
      list: [] as CurvePoint[],
      isEmptyAssets: true,
    };
  }

  const startData = {
    value: list[0][1] || 0,
    timestamp: list[0][0],
  };

  const result =
    list.map(x => {
      const change = x[1] - startData.value;

      if (x[1] > 0 && isEmptyAssets) {
        isEmptyAssets = false;
      }

      return {
        value: x[1] || 0,
        netWorth: x[1] ? formatUsdValue(x[1]) : '$0',
        change: numFormat(Math.abs(change), 0, '$'),
        isLoss: change < 0,
        changePercent:
          startData.value === 0
            ? `${x[1] === 0 ? '0' : '100.00'}%`
            : `${(Math.abs(change * 100) / startData.value).toFixed(2)}%`,
        timestamp: x[0],
        dateString: dayjs.unix(x[0]).format('MM DD, YYYY'),
      };
    }) || [];

  const endNetWorth = result.length ? result[result.length - 1]?.value : 0;
  const assetsChange = endNetWorth - startData.value;

  return {
    list: result as CurvePoint[],
    isLoss: assetsChange < 0,
    isEmptyAssets,
  };
};

export const useTimeMachineData = (enabled = false) => {
  const { currentAccount } = useCurrentAccount();

  const [cached, setCached] = useState(false);

  const { value: supportChainList } = useAsyncRetry(async () => {
    if (currentAccount?.address) {
      return openapi.getHistoryCurveSupportedList();
    }
    return undefined;
  }, [currentAccount?.address]);

  const { value, loading, retry } = useAsyncRetry(async () => {
    if (currentAccount?.address && cached) {
      return openapi.getHistoryCurve(currentAccount?.address);
    }
    return undefined;
  }, [currentAccount?.address, cached]);

  useEffect(() => {
    if (enabled) {
      setCached(true);
    }
  }, [enabled]);

  useEffect(() => {
    let id;
    if (!loading && !!value?.job) {
      id = setTimeout(() => {
        retry();
      }, 2000);
    }
    return () => {
      if (id) {
        clearTimeout(id);
      }
    };
  }, [loading, retry, value]);

  return {
    data: value,
    loading: !cached || !value || loading || !!value?.job,
    supportChainList: supportChainList?.supported_chains || [],
    isNoAssets: !loading && value?.result?.data?.usd_value_list?.length === 0,
  };
};
