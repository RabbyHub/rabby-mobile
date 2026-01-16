import {
  calcMaxPriorityFee,
  checkGasAndNonce,
  is7702Tx,
} from '@/utils/transaction';

import {
  ExplainTxResponse,
  GasLevel,
  ParseTxResponse,
  Tx,
  TxPushType,
} from '@rabby-wallet/rabby-api/dist/types';
import { findChain, isTestnet } from './chain';
import {
  keyringService,
  notificationService,
  preferenceService,
  transactionHistoryService,
  whitelistService,
} from '@/core/services';
import { apiKeyring, apiProvider } from '@/core/apis';
import { openapi, testOpenapi } from '@/core/request';
import { INTERNAL_REQUEST_ORIGIN, INTERNAL_REQUEST_SESSION } from '@/constant';
import { intToHex } from './number';

import BigNumber from 'bignumber.js';
import {
  explainGas,
  getNativeTokenBalance,
  getRecommendGas,
} from '@/components/Approval/components/SignTx/calc';
import { CHAINS_ENUM } from '@/constant/chains';
import { eventBus, EVENTS } from './events';
import {
  fetchActionRequiredData,
  parseAction,
} from '@rabby-wallet/rabby-action';
import { ALIAS_ADDRESS } from '@/constant/gas';
import { calcGasLimit } from '@/core/apis/transactions';
import { stats } from './stats';
import {
  KEYRING_CATEGORY_MAP,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { apisTransactionHistory } from '@/core/apis/transactionHistory';
import { getCexInfo } from '@/hooks/useCexSupportList';
import { isNonPublicProductionEnv } from '@/constant';
import { getDefaultStore } from 'jotai';
import { mockBatchRevokeStore } from '@/hooks/appSettings';
import { Account } from '@/core/services/preference';
import miscService from '@/core/services/misc';

// fail code
export enum FailedCode {
  GasNotEnough = 'GasNotEnough',
  GasTooHigh = 'GasTooHigh',
  SubmitTxFailed = 'SubmitTxFailed',
  DefaultFailed = 'DefaultFailed',
  SimulationFailed = 'SimulationFailed',
  UserRejected = 'UserRejected',
}

type ProgressStatus = 'building' | 'builded' | 'signed' | 'submitted';

const checkEnoughUseGasAccount = async ({
  gasAccount,
  transaction,
  currentAccountType,
}: {
  transaction: Tx;
  currentAccountType: string;
  gasAccount?: {
    sig: string | undefined;
    accountId: string | undefined;
  };
}) => {
  let gasAccountCanPay: boolean = false;

  // native gas not enough check gasAccount
  let gasAccountVerfiyPass = true;
  let gasAccountCost;
  try {
    gasAccountCost = await openapi.checkGasAccountTxs({
      sig: gasAccount?.sig || '',
      account_id: gasAccount?.accountId || '',
      tx_list: [transaction],
    });
  } catch (e) {
    gasAccountVerfiyPass = false;
  }
  gasAccountCanPay =
    gasAccountVerfiyPass &&
    currentAccountType !== KEYRING_TYPE.WalletConnectKeyring &&
    currentAccountType !== KEYRING_TYPE.WatchAddressKeyring &&
    !!gasAccountCost?.balance_is_enough &&
    !gasAccountCost.chain_not_support &&
    !!gasAccountCost.is_gas_account;

  return gasAccountCanPay;
};

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
 * @param isGasAccount is gas account
 * @param gasAccount gas account { sig, account }
 * @param autoUseGasAccount when gas balance is low , auto use gas account for gasfee
 * @param onUseGasAccount use gas account callback
 */
export const sendTransaction = async ({
  tx,
  chainServerId,
  ignoreGasCheck,
  onProgress,
  gasLevel,
  lowGasDeadline,
  isGasLess,
  isGasAccount,
  gasAccount,
  autoUseGasAccount,
  waitCompleted = true,
  pushType = 'default',
  ignoreGasNotEnoughCheck,
  onUseGasAccount,
  ga,
  sig,
  extra,
  ignoreSimulationFailed,
  account,
}: {
  tx: Tx;
  chainServerId: string;
  ignoreGasCheck?: boolean;
  ignoreGasNotEnoughCheck?: boolean;
  ignoreSimulationFailed?: boolean;
  onProgress?: (status: ProgressStatus) => void;
  onUseGasAccount?: () => void;
  extra?: {
    preExecResult?: ExplainTxResponse;
    actionData?: ParseTxResponse;
  };
  gasLevel?: GasLevel;
  lowGasDeadline?: number;
  isGasLess?: boolean;
  isGasAccount?: boolean;
  gasAccount?: {
    sig: string | undefined;
    accountId: string | undefined;
  };
  autoUseGasAccount?: boolean;
  waitCompleted?: boolean;
  pushType?: TxPushType;
  ga?: Record<string, any>;
  sig?: string;
  account: Account;
}) => {
  const MOCK_BATCH_REVOKE = mockBatchRevokeStore.getState();
  console.log('MOCK_BATCH_REVOKE', MOCK_BATCH_REVOKE);

  onProgress?.('building');
  const chain = findChain({
    serverId: chainServerId,
  })!;
  const support1559 = chain.eip['1559'];
  const { address, ...currentAccount } = account;

  const recommendNonce =
    tx.nonce ||
    (await apiProvider.getRecommendNonce({
      from: tx.from,
      chainId: chain.id,
      account,
    }));

  // get gas
  let normalGas = gasLevel;
  if (!normalGas) {
    const gasMarket = await apiProvider.gasMarketV2(
      {
        chain,
        tx,
      },
      account,
    );
    normalGas = gasMarket.find(item => item.level === 'normal')!;
  }

  const signingTxId = await transactionHistoryService.addSigningTx(tx);

  const reportGasLevel =
    normalGas.level || miscService.getCurrentGasLevel() || 'normal';

  stats.report('createTransaction', {
    type: currentAccount.brandName,
    category: KEYRING_CATEGORY_MAP[currentAccount.type],
    chainId: chain.serverId,
    createdBy: ga ? 'rabby' : 'dapp',
    source: ga?.source || '',
    trigger: ga?.trigger || '',
    networkType: chain?.isTestnet ? 'Custom Network' : 'Integrated Network',
    swapUseSlider: ga?.swapUseSlider ?? '',
    gasLevel: reportGasLevel,
  });

  // pre exec tx
  const preExecResult =
    extra?.preExecResult ||
    (await openapi.preExecTx({
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
      pending_tx_list: await apisTransactionHistory.getPendingTxs({
        recommendNonce,
        address,
        chainId: tx.chainId,
      }),
    }));

  const balance = await getNativeTokenBalance({
    chainId: chain.id,
    address,
    account,
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
      account,
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
    account,
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
  const ETH_GAS_USD_LIMIT = isNonPublicProductionEnv
    ? MOCK_BATCH_REVOKE.DEBUG_ETH_GAS_USD_LIMIT
    : 20;
  const OTHER_CHAIN_GAS_USD_LIMIT = isNonPublicProductionEnv
    ? MOCK_BATCH_REVOKE.DEBUG_OTHER_CHAIN_GAS_USD_LIMIT
    : 5;
  const DEBUG_SIMULATION_FAILED = isNonPublicProductionEnv
    ? MOCK_BATCH_REVOKE.DEBUG_SIMULATION_FAILED
    : false;

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

  let failedCode;
  let canUseGasAccount: boolean = false;
  // random simulation failed for test
  if (
    !ignoreSimulationFailed &&
    DEBUG_SIMULATION_FAILED &&
    Math.random() > 0.5
  ) {
    failedCode = FailedCode.SimulationFailed;
  } else if (
    !ignoreSimulationFailed &&
    !preExecResult?.balance_change?.success
  ) {
    failedCode = FailedCode.SimulationFailed;
  } else if (isGasNotEnough) {
    //  native gas not enough check gasAccount
    if (autoUseGasAccount && gasAccount?.sig && gasAccount?.accountId) {
      const gasAccountCanPay = await checkEnoughUseGasAccount({
        gasAccount,
        currentAccountType: currentAccount.type,
        transaction: {
          ...transaction,
          gas: gasLimit,
          gasPrice: intToHex(normalGas.price),
        },
      });
      if (gasAccountCanPay) {
        onUseGasAccount?.();
        canUseGasAccount = true;
      } else {
        failedCode = FailedCode.GasNotEnough;
      }
    } else {
      failedCode = FailedCode.GasNotEnough;
    }
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

  const maxPriorityFee =
    +(tx.maxPriorityFeePerGas || '') ||
    calcMaxPriorityFee([], normalGas, chain.id, true);
  const maxFeePerGas =
    tx.maxFeePerGas || tx.gasPrice || intToHex(Math.round(normalGas.price));

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
  const actionData =
    extra?.actionData ||
    (await openapi.parseTx({
      chainId: chain.serverId,
      tx: {
        ...tx,
        gas: '0x0',
        nonce: recommendNonce || '0x1',
        value: tx.value || '0x0',
        to: tx.to || '',
        type: is7702Tx(tx) ? 4 : support1559 ? 2 : undefined,
      } as any,
      origin: INTERNAL_REQUEST_SESSION.origin || '',
      addr: address,
    }));
  const parsed = parseAction({
    type: 'transaction',
    data: actionData.action,
    balanceChange: preExecResult.balance_change,
    tx: {
      ...tx,
      gas: '0x0',
      nonce: recommendNonce || '0x1',
      value: tx.value || '0x0',
    },
    preExecVersion: preExecResult.pre_exec_version,
    gasUsed: preExecResult.gas.gas_used,
    sender: tx.from,
  });
  const cexInfo = getCexInfo(parsed.send?.to || '');
  const requiredData = await fetchActionRequiredData({
    type: 'transaction',
    actionData: parsed,
    contractCall: actionData.contract_call,
    chainId: chain.serverId,
    sender: address,
    cex: cexInfo,
    walletProvider: {
      hasPrivateKeyInWallet: apiKeyring.hasPrivateKeyInWallet,
      hasAddress: keyringService.hasAddress.bind(keyringService),
      getWhitelist: async () => whitelistService.getWhitelist(),
      isWhitelistEnabled: async () => whitelistService.isWhitelistEnabled(),
      getPendingTxsByNonce: async (...args) =>
        transactionHistoryService.getPendingTxsByNonce(...args),
      findChain,
      ALIAS_ADDRESS,
    },
    tx: {
      ...tx,
      gas: '0x0',
      nonce: recommendNonce || '0x1',
      value: tx.value || '0x0',
    },
    apiProvider: openapi,
  });

  await transactionHistoryService.updateSigningTx(signingTxId, {
    rawTx: {
      nonce: recommendNonce,
    },
    explain: {
      ...preExecResult,
      calcSuccess: !(checkErrors.length > 0),
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

  if (isNonPublicProductionEnv) {
    if (MOCK_BATCH_REVOKE.DEBUG_MOCK_SUBMIT) {
      return {
        txHash: 'mock_hash',
        gasCost: estimateGasCost,
      };
    }
  }

  const handleSendAfter = async () => {
    const statsData = await notificationService.getStatsData();

    if (statsData?.signed) {
      const sData: any = {
        type: statsData?.type,
        chainId: statsData?.chainId,
        category: statsData?.category,
        success: statsData?.signedSuccess,
        preExecSuccess: statsData?.preExecSuccess,
        createdBy: statsData?.createdBy,
        source: statsData?.source,
        trigger: statsData?.trigger,
        networkType: chain?.isTestnet ? 'Custom Network' : 'Integrated Network',
      };
      if (statsData.signMethod) {
        sData.signMethod = statsData.signMethod;
      }
      stats.report('signedTransaction', sData);
    }
    if (statsData?.submit) {
      stats.report('submitTransaction', {
        type: statsData?.type,
        chainId: statsData?.chainId,
        category: statsData?.category,
        success: statsData?.submitSuccess,
        preExecSuccess: statsData?.preExecSuccess,
        createdBy: statsData?.createdBy,
        source: statsData?.source,
        trigger: statsData?.trigger,
        networkType: statsData?.networkType || '',
      });
    }
  };

  stats.report('signTransaction', {
    type: currentAccount.brandName,
    category: KEYRING_CATEGORY_MAP[currentAccount.type],
    chainId: chain.serverId,
    createdBy: ga ? 'rabby' : 'dapp',
    source: ga?.source || '',
    trigger: ga?.trigger || '',
    networkType: chain?.isTestnet ? 'Custom Network' : 'Integrated Network',
  });

  // submit tx
  let hash = '';
  try {
    hash = await apiProvider.ethSendTransaction({
      data: {
        $ctx: {
          ga,
        },
        params: [transaction],
      },
      session: INTERNAL_REQUEST_SESSION,
      approvalRes: {
        ...transaction,
        signingTxId,
        // logId: logId,
        lowGasDeadline,
        isGasLess,
        isGasAccount: autoUseGasAccount ? canUseGasAccount : isGasAccount,
        pushType,
        sig,
      },
      pushed: false,
      result: undefined,
      account,
    });
    await handleSendAfter();
  } catch (e) {
    await handleSendAfter();
    const err = new Error((e as any).message);
    err.name = FailedCode.SubmitTxFailed;
    eventBus.emit(EVENTS.COMMON_HARDWARE.REJECTED, err.message);
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

export const sendTransactionByMiniSignV2 = async ({
  tx,
  chainServerId,
  onProgress,
  lowGasDeadline,
  isGasLess,
  isGasAccount,
  pushType = 'default',
  ga,
  sig,
  session,
  account: _account,
  preExecResult,
}: {
  tx: Tx;
  chainServerId: string;
  onProgress?: (status: ProgressStatus) => void;
  lowGasDeadline?: number;
  isGasLess?: boolean;
  isGasAccount?: boolean;
  pushType?: TxPushType;
  ga?: Record<string, any>;
  sig?: string;
  session?: Parameters<typeof apiProvider.ethSendTransaction>[0]['session'];
  account: Account;
  preExecResult: ExplainTxResponse;
}) => {
  onProgress?.('building');

  const chain = findChain({
    serverId: chainServerId,
  })!;
  const support1559 = chain.eip['1559'];

  const currentAccount = _account;

  const signingTxId = await transactionHistoryService.addSigningTx(tx);

  const reportGasLevel = miscService.getCurrentGasLevel() || 'normal';

  stats.report('createTransaction', {
    type: currentAccount.brandName,
    category: KEYRING_CATEGORY_MAP[currentAccount.type],
    chainId: chain.serverId,
    createdBy: ga ? 'rabby' : 'dapp',
    source: ga?.source || '',
    trigger: ga?.trigger || '',
    networkType: chain?.isTestnet ? 'Custom Network' : 'Integrated Network',
    swapUseSlider: ga?.swapUseSlider ?? '',
    gasLevel: reportGasLevel,
  });

  const transaction: Tx = {
    from: tx.from,
    to: tx.to,
    data: tx.data,
    nonce: tx.nonce,
    value: tx.value,
    chainId: tx.chainId,
    gas: tx.gas,
  };

  const maxPriorityFee = +(tx.maxPriorityFeePerGas || '');
  const maxFeePerGas = tx.maxFeePerGas || tx.gasPrice;

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
      nonce: tx.nonce || '0x1',
      value: tx.value || '0x0',
      to: tx.to || '',
      type: is7702Tx(tx) ? 4 : support1559 ? 2 : undefined,
    } as any,
    origin: INTERNAL_REQUEST_SESSION.origin || '',
    addr: currentAccount.address,
  });
  const parsed = parseAction({
    type: 'transaction',
    data: actionData.action,
    balanceChange: preExecResult.balance_change,
    tx: {
      ...tx,
      gas: '0x0',
      nonce: tx.nonce || '0x1',
      value: tx.value || '0x0',
    },
    preExecVersion: preExecResult.pre_exec_version,
    gasUsed: preExecResult.gas.gas_used,
    sender: tx.from,
  });
  const cexInfo = getCexInfo(parsed.send?.to || '');
  const requiredData = await fetchActionRequiredData({
    type: 'transaction',
    actionData: parsed,
    contractCall: actionData.contract_call,
    chainId: chain.serverId,
    sender: currentAccount.address,
    cex: cexInfo,
    walletProvider: {
      hasPrivateKeyInWallet: apiKeyring.hasPrivateKeyInWallet,
      hasAddress: keyringService.hasAddress.bind(keyringService),
      getWhitelist: async () => whitelistService.getWhitelist(),
      isWhitelistEnabled: async () => whitelistService.isWhitelistEnabled(),
      getPendingTxsByNonce: async (...args) =>
        transactionHistoryService.getPendingTxsByNonce(...args),
      findChain,
      ALIAS_ADDRESS,
    },
    tx: {
      ...tx,
      gas: '0x0',
      nonce: tx.nonce || '0x1',
      value: tx.value || '0x0',
    },
    apiProvider: openapi,
  });

  await transactionHistoryService.updateSigningTx(signingTxId, {
    rawTx: {
      nonce: tx.nonce,
    },
    explain: {
      ...preExecResult,
      calcSuccess: true,
    },
    action: {
      actionData: parsed,
      requiredData,
    },
  });

  onProgress?.('builded');

  const handleSendAfter = async () => {
    const statsData = await notificationService.getStatsData();

    if (statsData?.signed) {
      const sData: any = {
        type: statsData?.type,
        chainId: statsData?.chainId,
        category: statsData?.category,
        success: statsData?.signedSuccess,
        preExecSuccess: statsData?.preExecSuccess,
        createdBy: statsData?.createdBy,
        source: statsData?.source,
        trigger: statsData?.trigger,
        networkType: statsData?.networkType,
      };
      if (statsData.signMethod) {
        sData.signMethod = statsData.signMethod;
      }
      stats.report('signedTransaction', sData);
    }
    if (statsData?.submit) {
      stats.report('submitTransaction', {
        type: statsData?.type,
        chainId: statsData?.chainId,
        category: statsData?.category,
        success: statsData?.submitSuccess,
        preExecSuccess: statsData?.preExecSuccess,
        createdBy: statsData?.createdBy,
        source: statsData?.source,
        trigger: statsData?.trigger,
        networkType: statsData?.networkType || '',
      });
    }
  };

  stats.report('signTransaction', {
    type: currentAccount.brandName,
    category: KEYRING_CATEGORY_MAP[currentAccount.type],
    chainId: chain.serverId,
    createdBy: ga ? 'rabby' : 'dapp',
    source: ga?.source || '',
    trigger: ga?.trigger || '',
    networkType: chain?.isTestnet ? 'Custom Network' : 'Integrated Network',
  });

  // submit tx
  let hash = '';
  const account = currentAccount;
  try {
    hash = await apiProvider.ethSendTransaction({
      data: {
        $ctx: {
          ga,
        },
        params: [
          {
            ...transaction,
            isSpeedUp: (tx as any)?.isSpeedUp,
            isCancel: (tx as any)?.isCancel,
          },
        ],
      },
      session: INTERNAL_REQUEST_SESSION,
      approvalRes: {
        ...transaction,
        signingTxId,
        lowGasDeadline,
        isGasLess,
        isGasAccount,
        pushType,
        sig,
      },
      pushed: false,
      result: undefined,
      account: account,
    });
    await handleSendAfter();
  } catch (e) {
    await handleSendAfter();
    const err = new Error((e as any).message);
    err.name = FailedCode.SubmitTxFailed;
    eventBus.emit(EVENTS.COMMON_HARDWARE.REJECTED, err.message);
    throw err;
  }

  onProgress?.('signed');

  return {
    txHash: hash,
  };
};
