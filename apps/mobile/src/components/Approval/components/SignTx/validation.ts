import i18n from '@/utils/i18n';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { getEIP7702MiniGasLimit } from '@/utils/7702';

const DEFAULT_GAS_LIMIT_RATIO = 1.5;
const MINIMUM_GAS_LIMIT = 21000;

export type SignTxCheckError = {
  code: number;
  msg: string;
  level?: 'warn' | 'danger' | 'forbidden';
};

const toHex = (value: number | string) => {
  return `0x${new BigNumber(value || 0).integerValue().toString(16)}`;
};

export const buildGasLevelValidationTx = ({
  tx,
  gas,
  support1559,
  enable7702,
}: {
  tx: Tx;
  gas: {
    price: number;
    gasLimit: number;
    nonce: number;
    maxPriorityFee?: number;
  };
  support1559: boolean;
  enable7702: boolean;
}) => {
  const nonceHex = toHex(gas.nonce);
  const gasLimitHex = enable7702
    ? getEIP7702MiniGasLimit(toHex(gas.gasLimit))
    : toHex(gas.gasLimit);

  const nextTx = support1559
    ? ({
        ...tx,
        maxFeePerGas: toHex(Math.round(gas.price)),
        maxPriorityFeePerGas:
          gas.maxPriorityFee !== undefined && gas.maxPriorityFee < 0
            ? tx.maxFeePerGas
            : toHex(Math.round(gas.maxPriorityFee || 0)),
        gas: gasLimitHex,
        nonce: nonceHex,
      } as Tx)
    : ({
        ...tx,
        gasPrice: toHex(Math.round(gas.price)),
        gas: gasLimitHex,
        nonce: nonceHex,
      } as Tx);

  return {
    tx: nextTx,
    nonceHex,
    gasLimitHex,
    validationGasPrice:
      nextTx.gasPrice || nextTx.maxFeePerGas || toHex(Math.round(gas.price)),
  };
};

export const getSharedGasAndNonceErrors = ({
  recommendGasLimitRatio,
  recommendGasLimit,
  recommendNonce,
  gasLimit,
  nonce,
  isCancel,
  isSpeedUp,
  isGnosisAccount,
}: {
  recommendGasLimitRatio: number;
  recommendGasLimit: number | string | BigNumber;
  recommendNonce: number | string | BigNumber;
  gasLimit: number | string | BigNumber;
  nonce: number | string | BigNumber;
  isCancel: boolean;
  isSpeedUp: boolean;
  isGnosisAccount: boolean;
}): SignTxCheckError[] => {
  const errors: SignTxCheckError[] = [];

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
    } else if (new BigNumber(gasLimit).lt(recommendGasLimit)) {
      errors.push({
        code: 3004,
        msg: i18n.t('page.signTx.gasLimitLessThanExpect'),
        level: 'warn',
      });
    }
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

export const getNativeGasBalanceErrors = ({
  tx,
  gasExplainResponse,
  isGnosisAccount,
  nativeTokenBalance,
}: {
  tx: Tx;
  gasExplainResponse: {
    maxGasCostAmount: BigNumber;
  };
  isGnosisAccount: boolean;
  nativeTokenBalance: string;
}): SignTxCheckError[] => {
  const errors: SignTxCheckError[] = [];

  let sendNativeTokenAmount = new BigNumber(tx.value);
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

  return errors;
};

export const checkGasAccountLevelInsufficient = async ({
  tx,
  gasLimitHex,
  validationGasPrice,
  validateGasAccountLevel,
}: {
  tx: Tx;
  gasLimitHex: string;
  validationGasPrice: string;
  validateGasAccountLevel: (txs: Tx[]) => Promise<{
    valid: boolean;
    cost: number;
    errors: SignTxCheckError[];
  }>;
}): Promise<[boolean, number]> => {
  const gasAccountValidation = await validateGasAccountLevel([
    {
      ...tx,
      gas: gasLimitHex,
      gasPrice: validationGasPrice,
    } as Tx,
  ]);

  return [!gasAccountValidation.valid, gasAccountValidation.cost];
};

export const checkNativeLevelInsufficient = async ({
  tx,
  gasPrice,
  gasUsed,
  chainId,
  nativeTokenPrice,
  gasLimitHex,
  recommendGasLimitRatio,
  recommendGasLimit,
  recommendNonce,
  nonceHex,
  isCancel,
  isSpeedUp,
  isGnosisAccount,
  nativeTokenBalance,
  explainGasFn,
}: {
  tx: Tx;
  gasPrice: number;
  gasUsed: number;
  chainId: number;
  nativeTokenPrice: number;
  gasLimitHex: string;
  recommendGasLimitRatio: number;
  recommendGasLimit: number | string | BigNumber;
  recommendNonce: number | string | BigNumber;
  nonceHex: string;
  isCancel: boolean;
  isSpeedUp: boolean;
  isGnosisAccount: boolean;
  nativeTokenBalance: string;
  explainGasFn: (params: {
    gasUsed: number;
    gasPrice: number;
    chainId: number;
    nativeTokenPrice: number;
    tx: Tx;
    gasLimit: string;
  }) => Promise<{
    maxGasCostAmount: BigNumber;
  }>;
}): Promise<[boolean, number]> => {
  const gasExplain = await explainGasFn({
    gasUsed,
    gasPrice,
    chainId,
    nativeTokenPrice,
    tx,
    gasLimit: gasLimitHex,
  });

  const sharedErrors = getSharedGasAndNonceErrors({
    recommendGasLimitRatio,
    recommendGasLimit,
    recommendNonce,
    gasLimit: Number(gasLimitHex),
    nonce: Number(nonceHex),
    isCancel,
    isSpeedUp,
    isGnosisAccount,
  });
  const balanceErrors = getNativeGasBalanceErrors({
    tx,
    gasExplainResponse: gasExplain,
    isGnosisAccount,
    nativeTokenBalance,
  });

  return [
    [...sharedErrors, ...balanceErrors].some(item => item.code === 3001),
    0,
  ];
};
