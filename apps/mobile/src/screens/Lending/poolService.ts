/**
 * @description 构建交易相关函数:
 * supply、withdraw、borrow、repay、collateralSwitch、manageEmode等操作的tx构建
 * 但不包含approve交易
 */

import { ChainId, Pool, PoolBundle } from '@aave/contract-helpers';
import type { PopulatedTransaction } from 'ethers';
import { referralCode } from './utils/constant';

export enum InterestRate {
  None = 'None',
  Stable = 'Stable',
  Variable = 'Variable',
}

export const optimizedPath = (currentChainId?: ChainId) => {
  if (!currentChainId) {
    return false;
  }
  return (
    currentChainId === ChainId.arbitrum_one ||
    currentChainId === ChainId.optimism
    // ||
    // currentChainId === ChainId.optimism_kovan
  );
};

export const buildSupplyTx = async ({
  poolBundle,
  amount,
  address,
  reserve,
  useOptimizedPath,
}: {
  poolBundle: PoolBundle;
  amount: string;
  address: string;
  reserve: string;
  useOptimizedPath?: boolean;
}) => {
  return poolBundle.supplyTxBuilder.generateTxData({
    user: address,
    reserve: reserve,
    amount: amount,
    useOptimizedPath: !!useOptimizedPath,
    referralCode,
  });
};

type BuildWithdrawTxParams = {
  pool: Pool;
  amount: string;
  address: string;
  reserve: string;
  aTokenAddress: string;
  useOptimizedPath?: boolean;
};

export async function buildWithdrawTx(params: BuildWithdrawTxParams) {
  const { pool, amount, address, reserve, aTokenAddress, useOptimizedPath } =
    params;

  const withdrawResult = await pool.withdraw({
    user: address,
    reserve,
    amount,
    aTokenAddress,
    useOptimizedPath: !!useOptimizedPath,
  });
  const actionTx = withdrawResult.find(tx => tx.txType === 'DLP_ACTION');
  if (!actionTx) {
    throw new Error('Withdraw action tx not found');
  }

  try {
    return await actionTx.tx();
  } catch (error) {
    const transaction = (error as { transaction?: PopulatedTransaction })
      .transaction;
    if (transaction) {
      return transaction;
    }
    throw error;
  }
}

export const buildBorrowTx = async ({
  poolBundle,
  amount,
  address,
  reserve,
  debtTokenAddress,
  useOptimizedPath,
}: {
  poolBundle: PoolBundle;
  amount: string;
  address: string;
  reserve: string;
  debtTokenAddress: string;
  useOptimizedPath?: boolean;
}) => {
  return poolBundle.borrowTxBuilder.generateTxData({
    user: address,
    amount: amount,
    reserve: reserve,
    debtTokenAddress,
    interestRateMode: InterestRate.Variable,
    useOptimizedPath: !!useOptimizedPath,
    referralCode,
  });
};

export const buildRepayTx = async ({
  poolBundle,
  amount,
  address,
  reserve,
  useOptimizedPath,
  repayWithATokens,
  encodedTxData,
}: {
  poolBundle: PoolBundle;
  amount: string;
  address: string;
  reserve: string;
  useOptimizedPath?: boolean;
  repayWithATokens?: boolean;
  encodedTxData?: string;
}) => {
  if (repayWithATokens) {
    return poolBundle.repayWithATokensTxBuilder.generateTxData({
      user: address,
      reserve,
      amount,
      rateMode: InterestRate.Variable,
      useOptimizedPath: !!useOptimizedPath,
      encodedTxData,
    });
  }
  return poolBundle.repayTxBuilder.generateTxData({
    user: address,
    reserve,
    amount,
    interestRateMode: InterestRate.Variable,
    useOptimizedPath: !!useOptimizedPath,
  });
};

export const collateralSwitchTx = async ({
  pool,
  address,
  reserve,
  usageAsCollateral,
  useOptimizedPath,
}: {
  pool: Pool;
  address: string;
  reserve: string;
  usageAsCollateral: boolean;
  useOptimizedPath?: boolean;
}) => {
  return pool.setUsageAsCollateral({
    user: address,
    reserve,
    usageAsCollateral,
    useOptimizedPath: !!useOptimizedPath,
  });
};

export const buildManageEmodeTx = async ({
  pool,
  address,
  categoryId,
}: {
  pool: Pool;
  address: string;
  categoryId: number;
}) => {
  // categoryId如果是0，则表示取消E-Mode
  return pool.setUserEMode({
    user: address,
    categoryId,
  });
};
