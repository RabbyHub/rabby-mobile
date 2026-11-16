import { useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { useMemo } from 'react';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { formatPrice } from '@/utils/number';
import {
  CandleData,
  CandlePeriod,
} from '@/components2024/TradingViewCandleChart/type';

export const fetchTokenPriceData = async (
  token: {
    chain: string;
    tokenId: string;
  },
  interval: string,
  afterTimeAt?: number,
): Promise<CandleData> => {
  const data = await openapi.getTokenKlineData({
    token_id: token.tokenId,
    chain_id: token.chain,
    after_time_at: afterTimeAt,
    interval,
  });

  return {
    coin: `${token.chain}:${token.tokenId}`,
    interval: interval as CandlePeriod,
    showVolume: true,
    candles: data.data_list.map(item => ({
      time: item[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
      volume: item[5],
    })),
  };
};

export const useTokenMarketInfo = (token: {
  chain: string;
  tokenId: string;
}) => {
  const { data: marketInfo, loading: marketInfoLoading } = useRequest(
    async () => {
      const res = await openapi.getTokenMarketInfo({
        token_id: token.tokenId,
        chain_id: token.chain,
      });
      return res;
    },
    {
      refreshDeps: [token.chain, token.tokenId],
    },
  );

  const { data: holdInfo, loading: holdInfoLoading } = useRequest(
    async () => {
      const res = await openapi.getTokenHolderInfo({
        token_id: token.tokenId,
        chain_id: token.chain,
      });
      return res;
    },
    {
      refreshDeps: [token.chain, token.tokenId],
    },
  );

  const { data: supplyInfo, loading: supplyInfoLoading } = useRequest(
    async () => {
      const res = await openapi.getTokenSupplyInfo({
        token_id: token.tokenId,
        chain_id: token.chain,
      });
      return res;
    },
    {
      refreshDeps: [token.chain, token.tokenId],
    },
  );

  return {
    marketInfo,
    marketInfoLoading,
    holdInfo,
    holdInfoLoading,
    supplyInfo,
    supplyInfoLoading,
  };
};

export const useSingleTokenBalance = ({ token }: { token: TokenItem }) => {
  const amountSum = useMemo(() => {
    return token.amount;
  }, [token.amount]);

  const usdValue = useMemo(() => {
    const _usdValue = token.price * amountSum;
    return formatPrice(_usdValue || 0, 8, true);
  }, [token.price, amountSum]);

  const has24hChangeData = useMemo(() => {
    const price24hChange = token?.price_24h_change;
    return price24hChange !== null && price24hChange !== undefined;
  }, [token?.price_24h_change]);

  const percentChange = useMemo(() => {
    if (!has24hChangeData) {
      return '';
    }
    if (!token?.price_24h_change) {
      return '0%';
    }
    return (
      Math.abs(Number(token?.price_24h_change || 0) * 100).toFixed(2) + '%'
    );
  }, [has24hChangeData, token?.price_24h_change]);

  const is24hNoChange = useMemo(() => {
    return has24hChangeData && Number(token?.price_24h_change) === 0;
  }, [has24hChangeData, token?.price_24h_change]);

  const isLoss = useMemo(() => {
    return has24hChangeData ? Number(token.price_24h_change) < 0 : false;
  }, [has24hChangeData, token?.price_24h_change]);

  const price = useMemo(() => {
    return token.price;
  }, [token.price]);

  return {
    amountSum,
    usdValue,
    percentChange,
    has24hChangeData,
    isLoss,
    is24hNoChange,
    price,
  };
};
