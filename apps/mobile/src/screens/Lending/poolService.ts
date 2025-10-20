import { poolBundle } from './hooks';

export const buildSupplyTx = async ({
  amount,
  address,
  reserve,
}: {
  amount: string;
  address: string;
  reserve: string;
}) => {
  return poolBundle.supplyTxBuilder.generateTxData({
    user: address,
    reserve: reserve,
    amount: amount,
    useOptimizedPath: false, // 主网上没有优化，其他链有优化，下次需要配置
  });
};
