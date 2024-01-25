import { useEffect } from 'react';
import { useQuery } from 'react-query';
import { useIsFocused } from '@react-navigation/native';

import { request, queryClient, numFormat } from '@/utils';

type AssetsCurve = {
  // usd, timestamp
  usd_value_list: [number, number][];
};

type GasLevel = {
  estimated_seconds: number;
  front_tx_count: number;
  price: number;
};

type GasResponse = {
  gas_price_dict: Record<string, GasLevel>;
  price_change: {
    last_price: number;
    change_percent: number;
  };
};

export type ChangeValue = {
  netWorth: string;
  netChange: string;
  netPercentage: string;
  isUp: boolean;
  zeroAssets: boolean;
  maxValue: number;
  minValue: number;
};

export type ChartData = {
  list: {
    value: number;
    netWorth: string;
    change: string;
    isUp: boolean;
    changePecentage: string;
    timestamp: number;
  }[];
} & ChangeValue;

const formChartData = (data: AssetsCurve): ChartData => {
  const startData = {
    value: data?.usd_value_list[0][1] || 0,
    timestamp: data?.usd_value_list[0][0],
  };
  let minValue = data?.usd_value_list[0][1] || 0;
  let maxValue = minValue;

  const list =
    data?.usd_value_list.map(x => {
      const change = x[1] - startData.value;

      if (x[1] > maxValue) {
        maxValue = x[1];
      }

      if (x[1] < minValue) {
        minValue = x[1];
      }

      return {
        value: x[1] || 0,
        netWorth: x[1] ? numFormat(x[1], 0, '$') : '$0',
        change: `(${numFormat(Math.abs(change), 0, '$')})`,
        isUp: change >= 0,
        changePecentage:
          startData.value === 0
            ? `+${x[1] === 0 ? '0' : '100.00'}%`
            : `${change > 0 ? '+' : ''}${(
                (change * 100) /
                startData.value
              ).toFixed(2)}%`,
        timestamp: x[0] * 1000,
      };
    }) || [];

  const endNetWorth = list.at(-1)?.value || 0;
  const assetsChange = endNetWorth - startData.value;
  const zeroAssets = endNetWorth === 0 && startData.value === 0;

  // console.log('---', assetsChange, startData.value, assetsChange.div(startData.value));

  return {
    list,
    netWorth: endNetWorth === 0 ? '$0' : numFormat(endNetWorth, 0, '$'),
    netChange: `(${numFormat(Math.abs(assetsChange), 0, '$')})`,
    netPercentage:
      startData.value !== 0
        ? `${assetsChange >= 0 ? '+' : ''}${(
            (assetsChange * 100) /
            startData.value
          ).toFixed(2)}%`
        : `+${endNetWorth === 0 ? '0' : '100.00'}%`,
    isUp: assetsChange > 0,
    zeroAssets,
    maxValue,
    minValue,
  };
};

const formatGas = (gasResponse: GasResponse) => {
  const gas = Number(
    (gasResponse.gas_price_dict?.fast?.price / 1e9).toFixed(4),
  );
  const isUp =
    gasResponse?.price_change && gasResponse?.price_change?.change_percent >= 0;
  const noPrice = !gasResponse?.price_change?.last_price;

  return {
    price: gasResponse?.price_change
      ? numFormat(gasResponse?.price_change?.last_price, 2, '$')
      : '-',
    _change: gasResponse?.price_change?.change_percent
      ? numFormat(gasResponse?.price_change?.change_percent, 2, '', true)
      : '-',
    gas,
    isUp,
    noPrice,
  };
};

export const useQueryUsdCurve = (userId: string) => {
  const url = '/asset/net_curve_24h';

  return useQuery(
    [url, userId],
    ({ signal }) =>
      request.get<AssetsCurve>(url, { params: { user_addr: userId }, signal }),
    {
      select: formChartData,
    },
  );
};

export const useQueryGasPrice = (token: string) => {
  const url = `/chain/${token}`;
  const isFocused = useIsFocused();

  return useQuery(
    [url],
    () =>
      request.get<GasResponse>(url, {
        hideErrorTip: true,
      }),
    {
      select: formatGas,
      refetchInterval: () => (isFocused ? 3000 : false),
      enabled: true,
    },
  );
};

export const invalidateAssetCurve = () => {
  queryClient.invalidateQueries(['/asset/net_curve_24h']);
  queryClient.invalidateQueries(['/fiat_rates/curve']);
};
