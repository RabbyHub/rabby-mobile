import { useMemoizedFn, useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { useEffect, useMemo, useState } from 'react';
import {
  TokenItem,
  TokenItemWithEntity,
} from '@rabby-wallet/rabby-api/dist/types';
import { patchSingleToken } from '@/databases/sync/assets';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { RelatedDeFiType, TokenFromAddressItem } from '.';
import { unionBy } from 'lodash';
import { formatPrice } from '@/utils/number';
import {
  CandleData,
  CandlePeriod,
} from '@/components2024/TradingViewCandleChart/type';

export const useTokenDetail = (
  chain: string,
  tokenId: string,
  addresses: string[],
  fromAddress?: { address: string; amount: number }[],
  isSingleAddress?: boolean,
) => {
  const [loading, setLoading] = useState(false);
  const [tokensByAddress, setTokensByAddress] = useState<
    Record<string, TokenItem>
  >({});
  const [failedAddresses, setFailedAddresses] = useState<string[]>([]);

  const fetchSingleToken = useMemoizedFn(async (address: string) => {
    try {
      const res = (await openapi.getToken(
        address,
        chain,
        tokenId,
      )) as TokenItemWithEntity;
      const cex_ids = res.identity?.cex_list?.map(item => item.id);
      res.cex_ids = cex_ids || [];
      return res;
    } catch (error) {
      console.error(`Failed to fetch token for address ${address}:`, error);
      throw error;
    }
  });

  const fetchAllAddressTokens = useMemoizedFn(async () => {
    try {
      if (addresses.length === 0 || isSingleAddress) {
        return;
      }

      console.log('fetchAllAddressTokens exe', addresses);

      setLoading(true);
      setFailedAddresses([]);

      const results = await Promise.allSettled(
        addresses.map(async address => {
          const token = await fetchSingleToken(address);
          const fromAddressItem = fromAddress?.find(item =>
            isSameAddress(item.address, address),
          );
          if (
            fromAddressItem &&
            (fromAddressItem.amount || 0) !== (token.amount || 0)
          ) {
            // only patch when amount is different
            patchSingleToken(address, token);
          }
          return { address, token };
        }),
      );

      const tokenTempObj: Record<string, TokenItem> = {};
      const failedAddressList: string[] = [];

      results.forEach((result, index) => {
        const address = addresses[index];

        if (result.status === 'fulfilled' && result.value.token) {
          if (result.value.token.amount) {
            tokenTempObj[address] = result.value.token;
          }
        } else {
          failedAddressList.push(address);
          if (result.status === 'rejected') {
            console.error(
              `Failed to fetch token for ${address}:`,
              result.reason,
            );
          }
        }
      });

      setTokensByAddress(tokenTempObj);
      setFailedAddresses(failedAddressList);

      console.log('fetchAllAddressTokens done');
      return {
        success: Object.keys(tokenTempObj).length,
        failed: failedAddressList.length,
        total: addresses.length,
      };
    } catch (error) {
      console.error('Unexpected error in fetchAllAddressTokens:', error);
      setFailedAddresses(addresses);
      throw error;
    } finally {
      setLoading(false);
    }
  });

  const isReady = useMemo(() => {
    return !loading && failedAddresses.length === 0;
  }, [loading, failedAddresses]);

  useEffect(() => {
    fetchAllAddressTokens();
  }, [fetchAllAddressTokens]);

  return {
    isReady,
    loading,
    tokensByAddress,
    failedAddresses,
    refetch: fetchAllAddressTokens,
  };
};

export const useTokenBalance = ({
  token,
  amountList,
  isSingleAddress,
  relateDefiList,
  currentAddress,
}: {
  token: TokenItem;
  amountList: TokenFromAddressItem[];
  isSingleAddress: boolean;
  relateDefiList: RelatedDeFiType[];
  currentAddress: string;
}) => {
  const amountSum = useMemo(() => {
    let deFiAmount = 0;
    relateDefiList?.forEach(item => {
      deFiAmount += item.amount;
    });

    if (isSingleAddress) {
      const tokenAmount = amountList.find(item =>
        isSameAddress(item.address, currentAddress),
      )?.amount;
      return (tokenAmount || 0) + deFiAmount;
    } else {
      const amountUnionBy = unionBy(amountList, item =>
        item.address.toLowerCase(),
      );
      const totalTokenAmount = amountUnionBy.reduce((acc, item) => {
        return acc + item.amount;
      }, 0);

      return totalTokenAmount + deFiAmount;
    }
  }, [amountList, isSingleAddress, relateDefiList, currentAddress]);

  const usdValue = useMemo(() => {
    const _usdValue = token.price * amountSum;
    return formatPrice(_usdValue || 0, 8, true);
  }, [token.price, amountSum]);

  const percentChange = useMemo(() => {
    return token?.price_24h_change
      ? Math.abs((token?.price_24h_change || 0) * 100).toFixed(2) + '%'
      : '';
  }, [token.price_24h_change]);

  const is24hNoChange = useMemo(() => {
    return !token?.price_24h_change;
  }, [token.price_24h_change]);

  const isLoss = useMemo(() => {
    return token.price_24h_change ? Number(token.price_24h_change) < 0 : false;
  }, [token.price_24h_change]);

  const price = useMemo(() => {
    return token.price;
  }, [token.price]);

  return {
    amountSum,
    usdValue,
    percentChange,
    isLoss,
    is24hNoChange,
    price,
  };
};

export const useRealTimeTokenInfo = (token: {
  chain: string;
  tokenId: string;
}) => {
  const [data, setData] = useState<
    {
      address: string;
      token: TokenItem;
    }[]
  >([]);
  const fetchData = useMemoizedFn(async (relatedAddresses: string[]) => {
    const results = await Promise.allSettled(
      relatedAddresses.map(async address => {
        const res = await openapi.getToken(address, token.chain, token.tokenId);
        return { address, token: res };
      }),
    );
    const successData = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    setData(successData);
    return successData;
  });
  return {
    tokens: data,
    refreshAsync: fetchData,
  };
};
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

  const percentChange = useMemo(() => {
    return token?.price_24h_change
      ? Math.abs((token?.price_24h_change || 0) * 100).toFixed(2) + '%'
      : '';
  }, [token.price_24h_change]);

  const is24hNoChange = useMemo(() => {
    return !token?.price_24h_change;
  }, [token.price_24h_change]);

  const isLoss = useMemo(() => {
    return token.price_24h_change ? Number(token.price_24h_change) < 0 : false;
  }, [token.price_24h_change]);

  const price = useMemo(() => {
    return token.price;
  }, [token.price]);

  return {
    amountSum,
    usdValue,
    percentChange,
    isLoss,
    is24hNoChange,
    price,
  };
};
