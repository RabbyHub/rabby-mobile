import { pool, poolBundle } from './hooks';

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

export const buildWithdrawTx = async ({
  amount,
  address,
  reserve,
  aTokenAddress,
}: {
  amount: string;
  address: string;
  reserve: string;
  aTokenAddress: string;
}) => {
  return pool.withdraw({
    user: address,
    reserve,
    amount,
    aTokenAddress,
    useOptimizedPath: false, // 主网上没有优化，其他链有优化，下次需要配置
  });
};
