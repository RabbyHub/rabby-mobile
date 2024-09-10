import {
  calcGasLimit,
  calcMaxPriorityFee,
  checkGasAndNonce,
  explainGas,
  getNativeTokenBalance,
  getPendingTxs,
} from '@/utils/transaction';

import { GasLevel, Tx, TxPushType } from '@rabby-wallet/rabby-api/dist/types';
import { findChain } from './chain';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { apiProvider } from '@/core/apis';
import { openapi } from '@/core/request';
import { INTERNAL_REQUEST_ORIGIN, INTERNAL_REQUEST_SESSION } from '@/constant';
import { intToHex } from './number';

import BigNumber from 'bignumber.js';
import { getRecommendGas } from '@/components/Approval/components/SignTx/calc';
import { CHAINS_ENUM } from '@/constant/chains';
import {
  fetchActionRequiredData,
  parseAction,
} from '@/components/Approval/components/Actions/utils';
import { eventBus, EVENTS } from './events';

// fail code
export enum FailedCode {
  GasNotEnough = 'GasNotEnough',
  GasTooHigh = 'GasTooHigh',
  SubmitTxFailed = 'SubmitTxFailed',
  DefaultFailed = 'DefaultFailed',
  UserRejected = 'UserRejected',
}

type ProgressStatus = 'building' | 'builded' | 'signed' | 'submitted';

/**
 * send transaction without rpcFlow
 * @param tx
 * @param chainServerId
 * @param wallet
 * @param ignoreGasCheck if ignore gas check
 * @param onProgress callback
 * @param gasLevel gas level, default is normal
 * @param lowGasDeadline low gas deadline
 * @param isGasLess is gas less
 */
export const sendTransaction = async ({
  tx,
  chainServerId,
  ignoreGasCheck,
  onProgress,
  gasLevel,
  lowGasDeadline,
  isGasLess,
  waitCompleted = true,
  pushType = 'default',
  ignoreGasNotEnoughCheck,
  onError,
}: {
  tx: Tx;
  chainServerId: string;
  ignoreGasCheck?: boolean;
  ignoreGasNotEnoughCheck?: boolean;
  onProgress?: (status: ProgressStatus) => void;
  gasLevel?: GasLevel;
  lowGasDeadline?: number;
  isGasLess?: boolean;
  waitCompleted?: boolean;
  pushType?: TxPushType;
  onError?: (err: any) => void;
}) => {
  onProgress?.('building');
  const chain = findChain({
    serverId: chainServerId,
  })!;
  const support1559 = chain.eip['1559'];
  const { address } = (await preferenceService.getCurrentAccount())!;
  const recommendNonce = await apiProvider.getRecommendNonce({
    from: tx.from,
    chainId: chain.id,
  });

  // get gas
  let normalGas = gasLevel;
  if (!normalGas) {
    const gasMarket = await openapi.gasMarket(chainServerId);
    normalGas = gasMarket.find(item => item.level === 'normal')!;
  }

  const signingTxId = await transactionHistoryService.addSigningTx(tx);

  // pre exec tx
  const preExecResult = await openapi.preExecTx({
    tx: {
      ...tx,
      nonce: recommendNonce,
      data: tx.data,
      value: tx.value || '0x0',
      gasPrice: intToHex(Math.round(normalGas.price)),
    },
    origin: INTERNAL_REQUEST_ORIGIN,
    address: address,
    updateNonce: true,
    pending_tx_list: await getPendingTxs({
      recommendNonce,
      address,
    }),
  });

  const balance = await getNativeTokenBalance({
    chainId: chain.id,
    address,
  });
  let estimateGas = 0;
  if (preExecResult.gas.success) {
    estimateGas = preExecResult.gas.gas_limit || preExecResult.gas.gas_used;
  }
  const {
    gas: gasRaw,
    needRatio,
    gasUsed,
  } = await getRecommendGas({
    gasUsed: preExecResult.gas.gas_used,
    gas: estimateGas,
    tx,
    chainId: chain.id,
  });
  const gas = new BigNumber(gasRaw);
  let gasLimit = tx.gas || tx.gasLimit;
  let recommendGasLimitRatio = 1;

  if (!gasLimit) {
    const {
      gasLimit: _gasLimit,
      recommendGasLimitRatio: _recommendGasLimitRatio,
    } = await calcGasLimit({
      chain,
      tx,
      gas,
      selectedGas: normalGas,
      nativeTokenBalance: balance,
      explainTx: preExecResult,
      needRatio,
    });
    gasLimit = _gasLimit;
    recommendGasLimitRatio = _recommendGasLimitRatio;
  }

  // calc gasCost
  const gasCost = await explainGas({
    gasUsed,
    gasPrice: normalGas.price,
    chainId: chain.id,
    nativeTokenPrice: preExecResult.native_token.price,
    tx,
    gasLimit,
  });

  // check gas errors
  const checkErrors = ignoreGasNotEnoughCheck
    ? []
    : checkGasAndNonce({
        recommendGasLimit: `0x${gas.toString(16)}`,
        recommendNonce,
        gasLimit: Number(gasLimit),
        nonce: Number(recommendNonce || tx.nonce),
        gasExplainResponse: gasCost,
        isSpeedUp: false,
        isCancel: false,
        tx,
        isGnosisAccount: false,
        nativeTokenBalance: balance,
        recommendGasLimitRatio,
      });

  const isGasNotEnough = !isGasLess && checkErrors.some(e => e.code === 3001);
  const ETH_GAS_USD_LIMIT = 20;
  const OTHER_CHAIN_GAS_USD_LIMIT = 5;
  let failedCode;
  if (isGasNotEnough) {
    failedCode = FailedCode.GasNotEnough;
  } else if (
    !ignoreGasCheck &&
    // eth gas > $20
    ((chain.enum === CHAINS_ENUM.ETH &&
      gasCost.gasCostUsd.isGreaterThan(ETH_GAS_USD_LIMIT)) ||
      // other chain gas > $5
      (chain.enum !== CHAINS_ENUM.ETH &&
        gasCost.gasCostUsd.isGreaterThan(OTHER_CHAIN_GAS_USD_LIMIT)))
  ) {
    failedCode = FailedCode.GasTooHigh;
  }

  if (failedCode) {
    throw {
      name: failedCode,
      gasCost,
    };
  }

  // generate tx with gas
  const transaction: Tx = {
    from: tx.from,
    to: tx.to,
    data: tx.data,
    nonce: recommendNonce,
    value: tx.value,
    chainId: tx.chainId,
    gas: gasLimit,
  };
  const maxPriorityFee = calcMaxPriorityFee([], normalGas, chain.id, true);
  const maxFeePerGas = intToHex(Math.round(normalGas.price));

  if (support1559) {
    transaction.maxFeePerGas = maxFeePerGas;
    transaction.maxPriorityFeePerGas =
      maxPriorityFee <= 0
        ? tx.maxFeePerGas
        : intToHex(Math.round(maxPriorityFee));
  } else {
    (transaction as Tx).gasPrice = maxFeePerGas;
  }

  // fetch action data
  const actionData = await openapi.parseTx({
    chainId: chain.serverId,
    tx: {
      ...tx,
      gas: '0x0',
      nonce: recommendNonce || '0x1',
      value: tx.value || '0x0',
      to: tx.to || '',
    },
    origin: INTERNAL_REQUEST_SESSION.origin || '',
    addr: address,
  });
  const parsed = parseAction(
    actionData.action,
    preExecResult.balance_change,
    {
      ...tx,
      gas: '0x0',
      nonce: recommendNonce || '0x1',
      value: tx.value || '0x0',
    },
    preExecResult.pre_exec_version,
    preExecResult.gas.gas_used,
  );
  const requiredData = await fetchActionRequiredData({
    origin: INTERNAL_REQUEST_SESSION.origin || '',
    actionData: parsed,
    contractCall: actionData.contract_call,
    chainId: chain.serverId,
    address,
    tx: {
      ...tx,
      gas: '0x0',
      nonce: recommendNonce || '0x1',
      value: tx.value || '0x0',
    },
  });

  await transactionHistoryService.updateSigningTx(signingTxId, {
    rawTx: {
      nonce: recommendNonce,
    },
    explain: {
      ...preExecResult,
    },
    action: {
      actionData: parsed,
      requiredData,
    },
  });
  const logId = actionData.log_id;
  const estimateGasCost = {
    gasCostUsd: gasCost.gasCostUsd,
    gasCostAmount: gasCost.gasCostAmount,
    nativeTokenSymbol: preExecResult.native_token.symbol,
    gasPrice: normalGas.price,
    nativeTokenPrice: preExecResult.native_token.price,
  };

  onProgress?.('builded');

  // submit tx
  let hash = '';
  try {
    hash = await Promise.race([
      apiProvider.ethSendTransaction({
        data: {
          $ctx: {},
          params: [transaction],
        },
        session: INTERNAL_REQUEST_SESSION,
        approvalRes: {
          ...transaction,
          signingTxId,
          // logId: logId,
          lowGasDeadline,
          isGasLess,
          pushType,
        },
        pushed: false,
        result: undefined,
      }),
      new Promise((_, reject) => {
        eventBus.once(EVENTS.LEDGER.REJECTED, async data => {
          const e = new Error(data);
          e.name = FailedCode.UserRejected;
          reject(e);
        });
      }),
    ]);
  } catch (e) {
    const err = new Error((e as any).message);
    err.name =
      err.name === FailedCode.UserRejected
        ? FailedCode.UserRejected
        : FailedCode.SubmitTxFailed;
    throw err;
  }

  onProgress?.('signed');

  if (waitCompleted) {
    // wait tx completed
    const txCompleted = await new Promise<{ gasUsed: number }>(resolve => {
      const handler = res => {
        if (res?.hash === hash) {
          eventBus.removeListener(EVENTS.TX_COMPLETED, handler);
          resolve(res || {});
        }
      };
      eventBus.addListener(EVENTS.TX_COMPLETED, handler);
    });

    // calc gas cost
    const gasCostAmount = new BigNumber(txCompleted.gasUsed)
      .times(estimateGasCost.gasPrice)
      .div(1e18);
    const gasCostUsd = new BigNumber(gasCostAmount).times(
      estimateGasCost.nativeTokenPrice,
    );

    return {
      txHash: hash,
      gasCost: {
        ...estimateGasCost,
        gasCostUsd,
        gasCostAmount,
      },
    };
  } else {
    return {
      txHash: hash,
      gasCost: {
        ...estimateGasCost,
      },
    };
  }
};
