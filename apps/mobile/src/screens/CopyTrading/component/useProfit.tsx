import { useCallback, useMemo, useState } from 'react';
import { useMemoizedFn, useRequest } from 'ahooks';
import {
  CopyTradingBuyItemEntity,
  QueryCopyTradingBuyItemResult,
} from '@/databases/entities/copyTradingBuyItem';
import { useFocusEffect } from '@react-navigation/native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import { debounce, groupBy } from 'lodash';
import { atom, useAtom } from 'jotai';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
const copyTradingProfitDataAtom = atom<{
  itemData: QueryCopyTradingBuyItemResult[];
  totalProfit: number;
  totalHoldValue: number;
} | null>(null);

export const useCopyTradingProfitData = () => {
  return useAtom(copyTradingProfitDataAtom);
};

export const useProfit = () => {
  const [loading, setLoading] = useState(true);
  const [priceByToken, setPriceByToken] = useState<Record<string, number>>({});
  const [profitData, setProfitData] = useAtom(copyTradingProfitDataAtom);

  const showProfitBar = useMemo(() => {
    return !loading;
  }, [loading]);

  const fetchProfitDataByEvent = useMemoizedFn(async () => {
    if (loading) {
      return;
    }

    const res = await CopyTradingBuyItemEntity.queryCopyTradingItems();
    const aggregatedData = groupByChainAndTokenId(res);
    const updatedData = aggregatedData.map(item => {
      const cachedPrice = priceByToken[`${item.chain}_${item.id}`];
      if (cachedPrice) {
        return {
          ...item,
          price: cachedPrice,
          holdingUsdValue: item.realAmount * cachedPrice,
        } as QueryCopyTradingBuyItemResult;
      }
      return item;
    });
    updateProfitData(
      updatedData.sort((a, b) => b.holdingUsdValue - a.holdingUsdValue),
    );
  });

  const debounceFetchProfitDataByEvent = useMemo(
    () => debounce(fetchProfitDataByEvent, 1000),
    [fetchProfitDataByEvent],
  );

  useAppOrmSyncEvents({
    taskFor: ['token'],
    onRemoteDataUpserted: useCallback(
      ctx => {
        if (!ctx.success) {
          return;
        }
        const { taskFor } = ctx;
        if (taskFor === 'token') {
          debounceFetchProfitDataByEvent();
        }
      },
      [debounceFetchProfitDataByEvent],
    ),
  });
  const groupByChainAndTokenId = useMemoizedFn(
    (itemData: QueryCopyTradingBuyItemResult[]) => {
      // group by chain and tokenId
      const groupedData = groupBy(itemData, item => `${item.chain}_${item.id}`);

      const aggregatedData = Object.values(groupedData).map(group => {
        const firstItem = group[0];

        // calc realAmount
        const totalRealAmount = group.reduce(
          (sum, item) => sum + item.realAmount,
          0,
        );

        // calc buy_price weighted average (by realAmount)
        const totalCost = group.reduce(
          (sum, item) => sum + item.realAmount * item.buy_price,
          0,
        );
        const avgBuyPrice =
          totalRealAmount > 0 ? totalCost / totalRealAmount : 0;

        // calc holdingUsdValue
        const newHoldingUsdValue = totalRealAmount * firstItem.price;

        // create new object, keep original entity structure
        const aggregatedItem = Object.assign(
          Object.create(Object.getPrototypeOf(firstItem)),
          {
            ...firstItem,
            realAmount: totalRealAmount,
            buy_price: avgBuyPrice,
            holdingUsdValue: newHoldingUsdValue,
          },
        ) as QueryCopyTradingBuyItemResult;

        return aggregatedItem;
      });

      return aggregatedData;
    },
  );

  const updateProfitData = useMemoizedFn(
    (itemData: QueryCopyTradingBuyItemResult[]) => {
      setProfitData({
        itemData: itemData,
        totalProfit: itemData.reduce(
          (acc, item) =>
            acc + item.holdingUsdValue - item.realAmount * item.buy_price,
          0,
        ),
        totalHoldValue: itemData.reduce(
          (acc, item) => acc + item.holdingUsdValue,
          0,
        ),
      });
    },
  );

  const updateSingleTokenPrice = useMemoizedFn(
    async (tokenId: string, chain: string, price: number) => {
      if (!profitData) {
        return;
      }
      let needUpdate = false;
      const newItemData = profitData.itemData.map(item => {
        if (item.id === tokenId && item.chain === chain) {
          needUpdate = true;
          return {
            ...item,
            price,
            holdingUsdValue: item.realAmount * price,
          } as QueryCopyTradingBuyItemResult;
        }
        return item;
      });

      if (needUpdate) {
        updateProfitData(newItemData);
      }
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
      if (itemData.length === 0) {
        return;
      }
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

      let newPriceByToken: Record<string, number> = {};
      let newItemData: QueryCopyTradingBuyItemResult[] = [...itemData];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.price) {
          newItemData[index].price = result.value.price;
          newItemData[index].holdingUsdValue =
            newItemData[index].realAmount * result.value.price;
          newPriceByToken[`${itemData[index].chain}_${itemData[index].id}`] =
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
      setPriceByToken(newPriceByToken);
      console.log(`getRealTimeApiToUpdatePrice time: ${Date.now() - time}ms`);
    },
  );

  const fetchProfitData = useMemoizedFn(async () => {
    setLoading(true);
    const res = await CopyTradingBuyItemEntity.queryCopyTradingItems();
    const aggregatedData = groupByChainAndTokenId(res);
    updateProfitData(
      aggregatedData.sort((a, b) => b.holdingUsdValue - a.holdingUsdValue),
    );
    getRealTimeApiToUpdatePrice(aggregatedData);
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
    updateSingleTokenPrice,
  };
};
