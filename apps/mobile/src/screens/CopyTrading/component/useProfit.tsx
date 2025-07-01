import { useCallback, useMemo, useState } from 'react';
import { useMemoizedFn, useRequest } from 'ahooks';
import { CopyTradingBuyItemEntity } from '@/databases/entities/copyTradgingBuyItem';
import { useFocusEffect } from '@react-navigation/native';
import { TokenItemEntity } from '@/databases/entities/tokenitem';

export const useProfit = () => {
  const [loading, setLoading] = useState(false);
  const [profitData, setProfitData] = useState<{
    itemData: (TokenItemEntity & { buy_amount: number; buy_price: number })[];
    totalProfit: number;
    totalHoldValue: number;
  } | null>(null);

  const showProfitBar = useMemo(() => {
    return profitData && profitData.itemData.length > 0 && !loading;
  }, [profitData, loading]);

  const fetchProfitData = useMemoizedFn(async () => {
    setLoading(true);
    const res = await CopyTradingBuyItemEntity.queryCopyTradingItems();
    setProfitData({
      itemData: res,
      totalProfit: res.reduce(
        (acc, item) =>
          acc +
          (Math.min(item.amount, item.buy_amount) * item.price -
            item.buy_amount * item.buy_price),
        0,
      ),
      totalHoldValue: res.reduce(
        (acc, item) =>
          acc + Math.min(item.amount, item.buy_amount) * item.price,
        0,
      ),
    });
    // todo fix may be delete all when no load token item assets
    // CopyTradingBuyItemEntity.deleteExpiredBuyItem();
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
