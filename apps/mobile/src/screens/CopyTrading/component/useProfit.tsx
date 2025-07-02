import { useCallback, useMemo, useState } from 'react';
import { useMemoizedFn, useRequest } from 'ahooks';
import {
  CopyTradingBuyItemEntity,
  QueryCopyTradingBuyItemResult,
} from '@/databases/entities/copyTradingBuyItem';
import { useFocusEffect } from '@react-navigation/native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';

export const useProfit = () => {
  const [loading, setLoading] = useState(false);
  const [profitData, setProfitData] = useState<{
    itemData: QueryCopyTradingBuyItemResult[];
    totalProfit: number;
    totalHoldValue: number;
  } | null>(null);

  const showProfitBar = useMemo(() => {
    return !loading;
  }, [loading]);

  const updateProfitData = useMemoizedFn(
    (itemData: QueryCopyTradingBuyItemResult[]) => {
      setProfitData({
        itemData,
        totalProfit: itemData.reduce(
          (acc, item) =>
            acc + item.holdingUsdValue - item.buy_amount * item.buy_price,
          0,
        ),
        totalHoldValue: itemData.reduce(
          (acc, item) => acc + item.holdingUsdValue,
          0,
        ),
      });
    },
  );

  const fetchSingleToken = useMemoizedFn(
    async (address: string, chain: string, tokenId: string) => {
      try {
        const res = (await openapi.getToken(
          address,
          chain,
          tokenId,
        )) as TokenItem;
        return res;
      } catch (error) {
        console.error(
          `Failed to fetch token for address ${address} ${chain} ${tokenId}:`,
          error,
        );
        throw error;
      }
    },
  );

  const getRealTimeApiToUpdatePrice = useMemoizedFn(
    async (itemData: QueryCopyTradingBuyItemResult[]) => {
      const top10Item = itemData.slice(0, 10);
      const time = Date.now();
      const results = await Promise.allSettled(
        top10Item.map(async item => {
          const token = await fetchSingleToken(
            item.owner_addr,
            item.chain,
            item.id,
          );
          return { ...item, price: token.price };
        }),
      );

      let newItemData: QueryCopyTradingBuyItemResult[] = [...itemData];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.price) {
          newItemData[index].price = result.value.price;
          newItemData[index].amount = result.value.amount;
          newItemData[index].holdingUsdValue =
            Math.min(result.value.amount, itemData[index].buy_amount) *
            result.value.price;
        } else {
          if (result.status === 'rejected') {
            console.error(
              `Failed to fetch token for ${itemData[index].owner_addr} ${itemData[index].chain} ${itemData[index].id}:`,
              result.reason,
            );
          }
        }
      });
      updateProfitData(
        newItemData.sort((a, b) => b.holdingUsdValue - a.holdingUsdValue),
      );
      console.log(`getRealTimeApiToUpdatePrice time: ${Date.now() - time}ms`);
    },
  );

  const fetchProfitData = useMemoizedFn(async () => {
    setLoading(true);
    const res = await CopyTradingBuyItemEntity.queryCopyTradingItems();
    updateProfitData(res);
    getRealTimeApiToUpdatePrice(res);
    CopyTradingBuyItemEntity.deleteExpiredBuyItem();
    setLoading(false);
  });

  useFocusEffect(
    useCallback(() => {
      fetchProfitData();
    }, [fetchProfitData]),
  );

  return {
    getProfit: fetchProfitData,
    profitData,
    showProfitBar,
  };
};
