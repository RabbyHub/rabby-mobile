import { pool, poolBundle } from './hooks';
import { referralCode } from './utils/constant';

export enum InterestRate {
  None = 'None',
  Stable = 'Stable',
  Variable = 'Variable',
}

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
    referralCode,
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

export const buildBorrowTx = async ({
  amount,
  address,
  reserve,
  debtTokenAddress,
}: {
  amount: string;
  address: string;
  reserve: string;
  debtTokenAddress: string;
}) => {
  return poolBundle.borrowTxBuilder.generateTxData({
    user: address,
    amount: amount,
    reserve: reserve,
    debtTokenAddress,
    interestRateMode: InterestRate.Variable,
    useOptimizedPath: false, // 主网上没有优化，其他链有优化，下次需要配置
    referralCode,
  });
};

export const buildRepayTx = async ({
  amount,
  address,
  reserve,
}: {
  amount: string;
  address: string;
  reserve: string;
}) => {
  return poolBundle.repayTxBuilder.generateTxData({
    user: address,
    reserve,
    amount,
    interestRateMode: InterestRate.Variable,
    useOptimizedPath: false,
  });
};
