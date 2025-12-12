import { TransactionGroup } from '@/core/services/transactionHistory';
import i18n from '@/utils/i18n';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { useEffect, useMemo, useState } from 'react';
import { openapi } from '@/core/request';
import { apiProvider } from '@/core/apis';
import {
  CAN_ESTIMATE_L1_FEE_CHAINS,
  DEFAULT_GAS_LIMIT_RATIO,
  MINIMUM_GAS_LIMIT,
} from '@/constant/gas';
import { transactionHistoryService } from '@/core/services';
import { findChain } from '@/utils/chain';
import { Account } from '@/core/services/preference';

export const getRecommendGas = async ({
  gas,
  tx,
  gasUsed,
  preparedHistoryGasUsed,
}: {
  gasUsed: number;
  gas: number;
  tx: Tx;
  chainId: number;
  preparedHistoryGasUsed?:
    | ReturnType<typeof openapi.historyGasUsed>
    | Awaited<ReturnType<typeof openapi.historyGasUsed>>;
}) => {
  if (gas > 0) {
    return {
      needRatio: true,
      gas: new BigNumber(gas),
      gasUsed,
    };
  }
  const txGas = tx.gasLimit || tx.gas;
  if (txGas && new BigNumber(txGas).gt(0)) {
    return {
      needRatio: true,
      gas: new BigNumber(txGas),
      gasUsed: Number(txGas),
    };
  }
  try {
    let res: Awaited<ReturnType<typeof openapi.historyGasUsed>>;
    if (!preparedHistoryGasUsed) {
      res = await openapi.historyGasUsed({
        tx: {
          ...tx,
          nonce: tx.nonce || '0x1', // set a mock nonce for explain if dapp not set it
          data: tx.data,
          value: tx.value || '0x0',
          gas: tx.gas || '', // set gas limit if dapp not set
        },
        user_addr: tx.from,
      });
    } else {
      res = await preparedHistoryGasUsed;
    }
    if (res.gas_used > 0) {
      return {
        needRatio: true,
        gas: new BigNumber(res.gas_used),
        gasUsed: res.gas_used,
      };
    }
  } catch (e) {
    // NOTHING
  }

  return {
    needRatio: false,
    gas: new BigNumber(1000000),
    gasUsed: 1000000,
  };
};

export const getRecommendNonce = async ({
  tx,
  chainId,
  account,
}: {
  tx: Tx;
  chainId: number;
  account: Account;
}) => {
  const chain = findChain({
    id: chainId,
  });
  if (!chain) {
    throw new Error('chain not found');
  }
  const onChainNonce = await apiProvider.requestETHRpc(
    {
      method: 'eth_getTransactionCount',
      params: [tx.from, 'latest'],
    },
    chain.serverId,
    account,
  );
  const localNonce =
    (await transactionHistoryService.getNonceByChain(tx.from, chainId)) || 0;
  return `0x${BigNumber.max(onChainNonce, localNonce).toString(16)}`;
};

export const getNativeTokenBalance = async ({
  address,
  chainId,
  account,
}: {
  address: string;
  chainId: number;
  account: Account;
}): Promise<string> => {
  const chain = findChain({
    id: chainId,
  });
  if (!chain) {
    throw new Error('chain not found');
  }
  const balance = await apiProvider.requestETHRpc(
    {
      method: 'eth_getBalance',
      params: [address, 'latest'],
    },
    chain.serverId,
    account,
  );
  return balance;
};

export const explainGas = async ({
  gasUsed,
  gasPrice,
  chainId,
  nativeTokenPrice,
  tx,
  gasLimit,
  account,
  preparedL1Fee,
}: {
  gasUsed: number | string;
  gasPrice: number | string;
  chainId: number;
  nativeTokenPrice: number;
  tx: Tx;
  gasLimit: string | undefined;
  account: Account;
  preparedL1Fee?: string | Promise<string>;
}) => {
  let gasCostTokenAmount = new BigNumber(gasUsed).times(gasPrice).div(1e18);
  let maxGasCostAmount = new BigNumber(gasLimit || 0).times(gasPrice).div(1e18);
  const chain = findChain({ id: chainId });
  if (!chain) throw new Error(`${chainId} is not found in supported chains`);
  if (CAN_ESTIMATE_L1_FEE_CHAINS.includes(chain.enum)) {
    let res =
      typeof preparedL1Fee === 'object' && 'then' in preparedL1Fee
        ? await preparedL1Fee
        : preparedL1Fee || undefined;
    if (!res) {
      res = await apiProvider.fetchEstimatedL1Fee(
        {
          txParams: tx,
          account,
        },
        chain.enum,
      );
    }
    gasCostTokenAmount = new BigNumber(res).div(1e18).plus(gasCostTokenAmount);
    maxGasCostAmount = new BigNumber(res).div(1e18).plus(maxGasCostAmount);
  }
  const gasCostUsd = new BigNumber(gasCostTokenAmount).times(nativeTokenPrice);

  return {
    gasCostUsd,
    gasCostAmount: gasCostTokenAmount,
    maxGasCostAmount,
  };
};

export const useExplainGas = ({
  gasUsed,
  gasPrice,
  chainId,
  nativeTokenPrice,
  tx,
  gasLimit,
  isReady,
  account,
}: {
  gasUsed: number | string;
  gasPrice: number | string;
  chainId: number;
  nativeTokenPrice: number;
  tx: Tx;
  gasLimit: string | undefined;
  isReady: boolean;
  account: Account;
}) => {
  const [result, setResult] = useState({
    gasCostUsd: new BigNumber(0),
    gasCostAmount: new BigNumber(0),
    maxGasCostAmount: new BigNumber(0),
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isReady) {
      explainGas({
        gasUsed,
        gasPrice,
        chainId,
        nativeTokenPrice,
        tx,
        gasLimit,
        account,
      }).then(data => {
        setResult(data);
        setIsLoading(false);
      });
    }
  }, [
    gasUsed,
    gasPrice,
    chainId,
    nativeTokenPrice,
    tx,
    gasLimit,
    isReady,
    account,
  ]);

  return useMemo(() => {
    return {
      ...result,
      isExplainingGas: isLoading,
    };
  }, [result, isLoading]);
};

export const checkGasAndNonce = ({
  recommendGasLimitRatio,
  recommendGasLimit,
  recommendNonce,
  tx,
  gasLimit,
  nonce,
  isCancel,
  gasExplainResponse,
  isSpeedUp,
  isGnosisAccount,
  nativeTokenBalance,
}: {
  recommendGasLimitRatio: number;
  nativeTokenBalance: string;
  recommendGasLimit: number | string | BigNumber;
  recommendNonce: number | string | BigNumber;
  tx: Tx;
  gasLimit: number | string | BigNumber;
  nonce: number | string | BigNumber;
  gasExplainResponse: ReturnType<typeof useExplainGas>;
  isCancel: boolean;
  isSpeedUp: boolean;
  isGnosisAccount: boolean;
}) => {
  const errors: {
    code: number;
    msg: string;
    level?: 'warn' | 'danger' | 'forbidden';
  }[] = [];
  if (!isGnosisAccount && new BigNumber(gasLimit).lt(MINIMUM_GAS_LIMIT)) {
    errors.push({
      code: 3006,
      msg: i18n.t('page.signTx.gasLimitNotEnough'),
      level: 'forbidden',
    });
  }
  if (
    !isGnosisAccount &&
    new BigNumber(gasLimit).lt(
      new BigNumber(recommendGasLimit).times(recommendGasLimitRatio),
    ) &&
    new BigNumber(gasLimit).gte(21000)
  ) {
    if (recommendGasLimitRatio === DEFAULT_GAS_LIMIT_RATIO) {
      const realRatio = new BigNumber(gasLimit).div(recommendGasLimit);
      if (realRatio.lt(DEFAULT_GAS_LIMIT_RATIO) && realRatio.gt(1)) {
        errors.push({
          code: 3004,
          msg: i18n.t('page.signTx.gasLimitLessThanExpect'),
          level: 'warn',
        });
      } else if (realRatio.lt(1)) {
        errors.push({
          code: 3005,
          msg: i18n.t('page.signTx.gasLimitLessThanGasUsed'),
          level: 'danger',
        });
      }
    } else {
      if (new BigNumber(gasLimit).lt(recommendGasLimit)) {
        errors.push({
          code: 3004,
          msg: i18n.t('page.signTx.gasLimitLessThanExpect'),
          level: 'warn',
        });
      }
    }
  }
  let sendNativeTokenAmount = new BigNumber(tx.value); // current transaction native token transfer count
  sendNativeTokenAmount = isNaN(sendNativeTokenAmount.toNumber())
    ? new BigNumber(0)
    : sendNativeTokenAmount;
  if (
    !isGnosisAccount &&
    gasExplainResponse.maxGasCostAmount
      .plus(sendNativeTokenAmount.div(1e18))
      .isGreaterThan(new BigNumber(nativeTokenBalance).div(1e18))
  ) {
    errors.push({
      code: 3001,
      msg: i18n.t('page.signTx.nativeTokenNotEngouthForGas'),
      level: 'forbidden',
    });
  }
  if (new BigNumber(nonce).lt(recommendNonce) && !(isCancel || isSpeedUp)) {
    errors.push({
      code: 3003,
      // @ts-ignore
      msg: i18n.t('page.signTx.nonceLowerThanExpect', [
        new BigNumber(recommendNonce),
      ]),
    });
  }
  return errors;
};

export const useCheckGasAndNonce = ({
  recommendGasLimitRatio,
  recommendGasLimit,
  recommendNonce,
  tx,
  gasLimit,
  nonce,
  isCancel,
  gasExplainResponse,
  isSpeedUp,
  isGnosisAccount,
  nativeTokenBalance,
}: Parameters<typeof checkGasAndNonce>[0]) => {
  return useMemo(
    () =>
      checkGasAndNonce({
        recommendGasLimitRatio,
        recommendGasLimit,
        recommendNonce,
        tx,
        gasLimit,
        nonce,
        isCancel,
        gasExplainResponse,
        isSpeedUp,
        isGnosisAccount,
        nativeTokenBalance,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      recommendGasLimit,
      recommendNonce,
      tx,
      gasLimit,
      nonce,
      isCancel,
      gasExplainResponse,
      isSpeedUp,
      isGnosisAccount,
      nativeTokenBalance,
    ],
  );
};
