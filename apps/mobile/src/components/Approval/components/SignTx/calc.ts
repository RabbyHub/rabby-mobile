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
import {
  GasTokenBalanceInfo,
  getTempoFeeTokenInfo,
  isTempoChain,
} from '@/utils/tempo';

const GAS_PRICE_DECIMALS = 18;

const rawAmountToBn = (
  value: string | number | BigNumber | null | undefined,
) => {
  if (BigNumber.isBigNumber(value)) {
    return value;
  }
  return new BigNumber(value || 0);
};

const pow10 = (decimals: number) => {
  return new BigNumber(10).pow(Math.max(0, decimals));
};

const convert18RawToTokenRaw = (
  rawAmountIn18: BigNumber,
  tokenDecimals: number,
) => {
  if (tokenDecimals === GAS_PRICE_DECIMALS) {
    return rawAmountIn18;
  }
  if (tokenDecimals > GAS_PRICE_DECIMALS) {
    return rawAmountIn18.times(pow10(tokenDecimals - GAS_PRICE_DECIMALS));
  }
  return rawAmountIn18.div(pow10(GAS_PRICE_DECIMALS - tokenDecimals));
};

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

export const getGasTokenBalance = async ({
  address,
  chainId,
  account,
}: {
  address: string;
  chainId: number;
  account: Account;
}): Promise<GasTokenBalanceInfo> => {
  const chain = findChain({
    id: chainId,
  });
  if (!chain) {
    throw new Error('chain not found');
  }

  if (isTempoChain(chain.serverId)) {
    const feeToken = await getTempoFeeTokenInfo({
      account,
      userAddress: address,
      chainServerId: chain.serverId,
    });
    return {
      rawBalance: rawAmountToBn(feeToken.rawBalanceHex || 0).toFixed(0),
      token: {
        tokenId: feeToken.tokenId,
        symbol: feeToken.symbol,
        decimals: feeToken.decimals,
        logoUrl: feeToken.logoUrl,
      },
    };
  }

  const balance = await apiProvider.requestETHRpc<string>(
    {
      method: 'eth_getBalance',
      params: [address, 'latest'],
    },
    chain.serverId,
    account,
  );

  return {
    rawBalance: rawAmountToBn(balance || 0).toFixed(0),
    token: {
      tokenId: chain.nativeTokenAddress,
      symbol: chain.nativeTokenSymbol,
      decimals: chain.nativeTokenDecimals || GAS_PRICE_DECIMALS,
      logoUrl: chain.nativeTokenLogo,
    },
  };
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
  const gasToken = await getGasTokenBalance({
    address,
    chainId,
    account,
  });

  return gasToken.rawBalance;
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
  gasTokenDecimals = GAS_PRICE_DECIMALS,
}: {
  gasUsed: number | string;
  gasPrice: number | string;
  chainId: number;
  nativeTokenPrice: number;
  tx: Tx;
  gasLimit: string | undefined;
  account: Account;
  preparedL1Fee?: string | Promise<string>;
  gasTokenDecimals?: number;
}) => {
  let gasCostRawAmountIn18 = rawAmountToBn(gasUsed).times(gasPrice);
  let maxGasCostRawAmountIn18 = rawAmountToBn(gasLimit || 0).times(gasPrice);
  let gasCostTokenAmount = gasCostRawAmountIn18.div(1e18);
  let maxGasCostAmount = maxGasCostRawAmountIn18.div(1e18);
  const chain = findChain({ id: chainId });
  if (!chain) {
    throw new Error(`${chainId} is not found in supported chains`);
  }
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
    gasCostRawAmountIn18 = gasCostRawAmountIn18.plus(rawAmountToBn(res));
    maxGasCostRawAmountIn18 = maxGasCostRawAmountIn18.plus(rawAmountToBn(res));
    gasCostTokenAmount = gasCostRawAmountIn18.div(1e18);
    maxGasCostAmount = maxGasCostRawAmountIn18.div(1e18);
  }
  const gasCostUsd = new BigNumber(gasCostTokenAmount).times(
    isTempoChain(chain.serverId) ? 1 : nativeTokenPrice,
  );
  const gasCostRawAmount = convert18RawToTokenRaw(
    gasCostRawAmountIn18,
    gasTokenDecimals,
  );
  const maxGasCostRawAmount = convert18RawToTokenRaw(
    maxGasCostRawAmountIn18,
    gasTokenDecimals,
  );

  return {
    gasCostUsd,
    gasCostAmount: gasCostTokenAmount,
    maxGasCostAmount,
    gasCostRawAmount,
    maxGasCostRawAmount,
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
  gasTokenDecimals = GAS_PRICE_DECIMALS,
}: {
  gasUsed: number | string;
  gasPrice: number | string;
  chainId: number;
  nativeTokenPrice: number;
  tx: Tx;
  gasLimit: string | undefined;
  isReady: boolean;
  account: Account;
  gasTokenDecimals?: number;
}) => {
  const [result, setResult] = useState({
    gasCostUsd: new BigNumber(0),
    gasCostAmount: new BigNumber(0),
    maxGasCostAmount: new BigNumber(0),
    gasCostRawAmount: new BigNumber(0),
    maxGasCostRawAmount: new BigNumber(0),
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
        gasTokenDecimals,
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
    gasTokenDecimals,
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
  gasTokenDecimals = GAS_PRICE_DECIMALS,
  checkTxValueInBalance = true,
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
  gasTokenDecimals?: number;
  checkTxValueInBalance?: boolean;
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
  const balanceRawAmount = rawAmountToBn(nativeTokenBalance || 0);
  const sendNativeTokenRawAmount = checkTxValueInBalance
    ? convert18RawToTokenRaw(rawAmountToBn(tx.value || 0), gasTokenDecimals)
    : new BigNumber(0);
  const maxGasCostRawAmount =
    gasExplainResponse.maxGasCostRawAmount ||
    rawAmountToBn(gasExplainResponse.maxGasCostAmount).times(
      pow10(gasTokenDecimals),
    );

  if (
    !isGnosisAccount &&
    maxGasCostRawAmount
      .plus(sendNativeTokenRawAmount)
      .isGreaterThan(balanceRawAmount)
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
  gasTokenDecimals = GAS_PRICE_DECIMALS,
  checkTxValueInBalance = true,
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
        gasTokenDecimals,
        checkTxValueInBalance,
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
      gasTokenDecimals,
      checkTxValueInBalance,
    ],
  );
};
