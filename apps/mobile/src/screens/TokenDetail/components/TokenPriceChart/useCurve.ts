import { openapi } from '@/core/request';
import { formatPrice } from '@/utils/number';
import { useRequest } from 'ahooks';
import dayjs from 'dayjs';
import { findLastIndex } from 'lodash';

export type CurvePoint = {
  value: number;
  netWorth: string;
  change: string;
  isLoss: boolean;
  changePercent: string;
  timestamp: number;
  dateString: string;
};

export const use24hCurveData = ({
  tokenId,
  serverId,
}: {
  tokenId: string;
  serverId: string;
}) => {
  return useRequest(
    async () => {
      const data = await openapi.getToken24hPrice({
        chain_id: serverId,
        id: tokenId,
      });
      const list =
        data.map(item => {
          const change = item.price - data[0].price;

          return {
            value: item.price || 0,
            netWorth: item.price ? '$' + formatPrice(item.price, 8) : '$0',
            // change: numFormat(Math.abs(change), 0, '$'),
            change: '$' + formatPrice(Math.abs(change), 8),
            isLoss: change < 0,
            changePercent:
              data[0].price === 0
                ? `${item.price === 0 ? '0' : '100.00'}%`
                : `${(Math.abs(change * 100) / data[0].price).toFixed(2)}%`,
            timestamp: item.time_at * 1000,
            dateString: dayjs.unix(item.time_at).format('MM DD, YYYY'),
          };
        }) || [];
      const endNetWorth = list.length ? list[list.length - 1]?.value : 0;
      const assetsChange = endNetWorth - (list[0]?.value || 0);
      return {
        list,
        isLoss: assetsChange < 0,
      };
    },
    {
      refreshDeps: [tokenId, serverId],
    },
  );
};

export const formatTokenDateCurve = (
  range: number[],
  data: { date_at: string; price: number }[],
) => {
  if (!data?.length) {
    return {
      list: [] as CurvePoint[],
      isEmptyAssets: true,
      isLoss: false,
    };
  }

  const startIdx = data.findIndex(
    item => dayjs(item.date_at).unix() >= range[0],
  );
  const endIdx = findLastIndex(
    data,
    item => dayjs(item.date_at).unix() <= range[1],
  );
  const list = data.slice(startIdx, endIdx + 1);

  if (!list?.length) {
    return {
      list: [] as CurvePoint[],
      isEmptyAssets: true,
      isLoss: false,
    };
  }

  const startData = {
    value: list[0].price || 0,
    timestamp: dayjs(list[0].date_at).valueOf(),
  };

  const result =
    list.map(item => {
      const change = item.price - startData.value;

      return {
        value: item.price || 0,
        netWorth: item.price ? '$' + formatPrice(item.price, 8) : '$0',
        // change: numFormat(Math.abs(change), 0, '$'),
        change: '$' + formatPrice(Math.abs(change), 8),
        isLoss: change < 0,
        changePercent:
          startData.value === 0
            ? `${item.price === 0 ? '0' : '100.00'}%`
            : `${(Math.abs(change * 100) / startData.value).toFixed(2)}%`,
        timestamp: dayjs(item.date_at).valueOf(),
        dateString: dayjs(item.date_at).format('MM DD, YYYY'),
      };
    }) || [];

  const endNetWorth = result.length ? result[result.length - 1]?.value : 0;
  const assetsChange = endNetWorth - startData.value;

  return {
    list: result as CurvePoint[],
    isLoss: assetsChange < 0,
    isEmptyAssets: false,
  };
};

export const useDateCurveData = ({
  tokenId,
  serverId,
  ready,
}: {
  tokenId: string;
  serverId: string;
  ready?: boolean;
}) => {
  return useRequest(
    async () => {
      const data = await openapi.getTokenDatePrice({
        chain_id: serverId,
        id: tokenId,
      });
      return data;
    },
    {
      refreshDeps: [tokenId, serverId],
      cacheKey: `date-token-price-${tokenId}-${serverId}`,
      staleTime: 20000,
      ready,
    },
  );
};
