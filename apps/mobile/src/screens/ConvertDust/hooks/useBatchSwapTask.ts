import { Account } from '@/core/services/preference';
import { DEX } from '@/constant/swap';
import { eventBus, EVENTS } from '@/utils/events';
import { getRpcTxReceipt } from '@/core/utils/tx';
import { useMiniSigner } from '@/hooks/useSigner';
import { findChain } from '@/utils/chain';
import { Chain, CHAINS_ENUM } from '@debank/common';
import {
  ExplainTxResponse,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { DEX_ENUM, DEX_SPENDER_WHITELIST } from '@rabby-wallet/rabby-swap';
import { useMemoizedFn } from 'ahooks';
import BigNumber from 'bignumber.js';
import { last, random } from 'lodash';
import PQueue from 'p-queue';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isSwapWrapToken,
  QuoteProvider,
  TDexQuoteData,
  useQuoteMethods,
  useSwapSupportedDexList,
} from '../../Swap/hooks';
import { twoStepChains } from '../../Swap/hooks/twoStepSwap';
import { buildDexSwap } from '../../Swap/hooks/swap';
import { DEFAULT_MAX_GAS_COST, DEFAULT_PRICE_IMPACT } from '../constant';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
export { FailedCode } from '@/utils/sendTransaction';

const TASK_CANCELLED_ERROR_NAME = 'BatchSwapTaskCancelled';
const TX_RECEIPT_POLL_INTERVAL = 5000;
const TX_RECEIPT_TIMEOUT = 60 * 1000;

const getTokenRawAmount = (token: TokenItem) =>
  new BigNumber(token.raw_amount_hex_str || 0, 16);

const createNamedError = (name: string, message?: string) => {
  const error = new Error(message || name);
  error.name = name;
  return error;
};

const createTaskCancelledError = () => {
  return createNamedError(
    TASK_CANCELLED_ERROR_NAME,
    'Batch swap task cancelled',
  );
};

const waitForTxCompleted = async ({
  hash,
  chainServerId,
  isTaskCancelled,
}: {
  hash: string;
  chainServerId: string;
  isTaskCancelled?: () => boolean;
}) => {
  return await new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let isSettled = false;
    let isChecking = false;

    const cleanup = () => {
      isSettled = true;
      eventBus.removeListener(EVENTS.TX_COMPLETED, handler);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    const rejectWithCleanup = (error: Error) => {
      cleanup();
      reject(error);
    };

    const rejectIfCancelled = () => {
      if (!isTaskCancelled?.()) {
        return false;
      }

      rejectWithCleanup(createTaskCancelledError());
      return true;
    };

    const scheduleNextCheck = () => {
      if (isSettled || timer) {
        return;
      }

      timer = setTimeout(() => {
        timer = null;
        checkReceipt();
      }, TX_RECEIPT_POLL_INTERVAL);
    };

    const checkReceipt = async () => {
      if (isSettled || isChecking || rejectIfCancelled()) {
        return;
      }

      try {
        isChecking = true;
        const res = await getRpcTxReceipt(chainServerId, hash);
        isChecking = false;

        if (isSettled || rejectIfCancelled()) {
          return;
        }

        if (res.code !== 0) {
          scheduleNextCheck();
          return;
        }

        cleanup();

        if (res.status) {
          resolve(true);
        } else {
          reject(new Error('tx failed'));
        }
      } catch (error) {
        isChecking = false;
        if (isSettled || rejectIfCancelled()) {
          return;
        }
        scheduleNextCheck();
      }
    };

    const handler = (res: { hash?: string }) => {
      if (res?.hash === hash) {
        checkReceipt();
      }
    };

    timeoutTimer = setTimeout(() => {
      rejectWithCleanup(new Error('tx receipt timeout'));
    }, TX_RECEIPT_TIMEOUT);
    eventBus.addListener(EVENTS.TX_COMPLETED, handler);
    checkReceipt();
  });
};

export const getActiveProvider = async ({
  account,
  chain,
  currentAddress,
  dexId,
  getSingleQuote,
  payToken,
  receiveToken,
  slippage = '3',
}: {
  account: Account;
  chain: NonNullable<ReturnType<typeof findChain>>;
  currentAddress: string;
  dexId: DEX_ENUM;
  getSingleQuote: (params: {
    dexId: DEX_ENUM;
    userAddress: string;
    payToken: TokenItem;
    receiveToken: TokenItem;
    slippage: string;
    chain: CHAINS_ENUM;
    payAmount: string;
    fee: string;
    inSufficient: boolean;
    account: Account;
    setQuote?: (quote: TDexQuoteData) => void;
  }) => Promise<TDexQuoteData | undefined>;
  payToken: TokenItem;
  receiveToken: TokenItem;
  slippage?: string;
}): Promise<QuoteProvider | null> => {
  const payAmount = getTokenRawAmount(payToken)
    .div(10 ** payToken.decimals)
    .toString(10);

  if (!new BigNumber(payAmount).gt(0)) {
    return null;
  }

  const quoteResult = await getSingleQuote({
    dexId,
    userAddress: currentAddress,
    payToken,
    receiveToken,
    slippage,
    chain: chain.enum,
    payAmount,
    fee: isSwapWrapToken(payToken.id, receiveToken.id, chain.enum)
      ? '0'
      : '0.25',
    inSufficient: false,
    account,
  });

  if (!quoteResult?.data || !quoteResult.preExecResult?.isSdkPass) {
    return null;
  }

  const actualReceiveAmount = new BigNumber(quoteResult.data.toTokenAmount)
    .div(10 ** (quoteResult.data.toTokenDecimals || receiveToken.decimals))
    .toString();

  return {
    name: quoteResult.name,
    quote: quoteResult.data,
    preExecResult: quoteResult.preExecResult,
    gasPrice: quoteResult.preExecResult.gasPrice,
    shouldApproveToken: !!quoteResult.preExecResult.shouldApproveToken,
    shouldTwoStepApprove: !!quoteResult.preExecResult.shouldTwoStepApprove,
    error: !quoteResult.preExecResult,
    halfBetterRate: '',
    quoteWarning: undefined,
    actualReceiveAmount,
    gasUsd: quoteResult.preExecResult.gasUsd,
  };
};

export const buildSwapTxs = async ({
  account,
  payToken,
  receiveToken,
  quote,
  activeProvider,

  preferMEVGuarded,
  chain,
  inputAmount,
  slippage,
  rbiSource,
  swapUseSlider,
}: {
  account: Account;
  payToken: TokenItem | null;
  receiveToken: TokenItem | null;
  quote: TDexQuoteData | null;
  activeProvider: QuoteProvider | null;
  preferMEVGuarded: boolean;
  chain: CHAINS_ENUM;
  inputAmount: string;
  slippage: string;
  rbiSource: any;
  swapUseSlider?: boolean;
}) => {
  const quoteResult = activeProvider?.quote || quote?.data;

  if (!payToken || !receiveToken || !quoteResult || !activeProvider) {
    return;
  }

  try {
    const toAmount = new BigNumber(quoteResult.toTokenAmount)
      .div(10 ** (quoteResult.toTokenDecimals || receiveToken.decimals))
      .toNumber();

    const result = await buildDexSwap(
      {
        swapPreferMEVGuarded: preferMEVGuarded,
        chain,
        quote: quoteResult,
        needApprove: activeProvider.shouldApproveToken,
        spender:
          activeProvider.name === DEX_ENUM.WRAPTOKEN
            ? ''
            : DEX_SPENDER_WHITELIST[activeProvider.name][chain],
        pay_token_id: payToken.id,
        unlimited: false,
        shouldTwoStepApprove: activeProvider.shouldTwoStepApprove,
        gasPrice: undefined,
        postSwapParams: {
          quote: {
            pay_token_id: payToken.id,
            pay_token_amount: Number(inputAmount),
            receive_token_id: receiveToken.id,
            receive_token_amount: toAmount,
            slippage: new BigNumber(slippage).div(100).toNumber(),
          },
          dex_id: activeProvider.name || 'WrapToken',
        },
        account,
      },
      {
        ga: {
          category: 'Swap',
          source: 'swap',
          trigger: rbiSource,
          swapUseSlider,
        },
      },
    );

    return result;
  } catch (error) {
    console.error(error);
  }
};

export type TaskItemStatus =
  | {
      status: 'idle';
      message?: string;
    }
  | {
      status: 'pending';
      isGasAccount?: boolean;
      message?: string;
    }
  | {
      status: 'failed';
      createdAt?: number;
      message?: string;
    }
  | {
      status: 'success';
      txHash: string;
      preExecResult?: ExplainTxResponse;
      actualReceiveAmount?: string | number;
      createdAt?: number;
      message?: string;
    };

export const useBatchSwapTask = (options: {
  chain?: Chain;
  account?: Account;
  receiveToken?: TokenItem;
}) => {
  const { account, chain } = options;
  const { t } = useTranslation();
  const queueRef = React.useRef(
    new PQueue({ concurrency: 1, autoStart: true }),
  );
  const [list, setList] = React.useState<TokenItem[]>([]);
  const [statusDict, setStatusDict] = React.useState<
    Record<string, TaskItemStatus>
  >({});

  const [config, setConfig] = React.useState<{
    priceImpact: string;
    maxGasCost: string;
  }>({
    priceImpact: DEFAULT_PRICE_IMPACT,
    maxGasCost: DEFAULT_MAX_GAS_COST,
  });

  const slippage = useMemo(() => {
    // 预留一半价差给滑点，避免用户设置的价差过小导致频繁交易失败
    return new BigNumber(config.priceImpact).div(2).toString(10);
  }, [config.priceImpact]);

  const priceImpactLimit = slippage;

  const [status, setStatus] = React.useState<
    'idle' | 'active' | 'paused' | 'completed'
  >('idle');
  const statusRef = React.useRef<'idle' | 'active' | 'paused' | 'completed'>(
    'idle',
  );
  const [txStatus, setTxStatus] = React.useState<'sended' | 'signed' | 'idle'>(
    'idle',
  );
  const cancelTokenRef = React.useRef(0);
  const currentApprovalRef = React.useRef<TokenItem | undefined>(undefined);
  const [currentToken, setCurrentToken] = React.useState<TokenItem | null>(
    null,
  );
  const { getSingleQuote } = useQuoteMethods();

  const {
    prefetch,
    close: closeSign,
    openDirect,
  } = useMiniSigner({
    account: account!,
    chainServerId: chain?.serverId || '',
    autoResetGasStoreOnChainChange: true,
  });

  const [supportedDexList] = useSwapSupportedDexList();
  const dexList = useMemo(
    () => supportedDexList.filter(e => DEX[e]),
    [supportedDexList],
  );

  const getDexId = useMemoizedFn(() => {
    const randomIndex = random(0, dexList.length - 1);
    return dexList[randomIndex] as DEX_ENUM;
  });

  const updateStatus = React.useCallback(
    (nextStatus: 'idle' | 'active' | 'paused' | 'completed') => {
      statusRef.current = nextStatus;
      setStatus(nextStatus);
    },
    [],
  );

  const cancelRunningTasks = useMemoizedFn(() => {
    cancelTokenRef.current += 1;
    queueRef.current.pause();
    queueRef.current.clear();
    closeSign();
  });

  const addTask = useMemoizedFn(
    async (item: TokenItem, priority: number = 0) => {
      const taskToken = cancelTokenRef.current;
      const isTaskCancelled = () => cancelTokenRef.current !== taskToken;
      const throwIfTaskCancelled = () => {
        if (isTaskCancelled()) {
          throw createTaskCancelledError();
        }
      };

      return queueRef.current.add(
        async () => {
          try {
            throwIfTaskCancelled();
            closeSign();

            const dexId = getDexId();

            if (
              !options.chain ||
              !options.account ||
              !options.receiveToken ||
              !dexId
            ) {
              throw new Error(
                t('page.convertDust.failReason.quoteUnavailable'),
              );
            }
            currentApprovalRef.current = item;
            setCurrentToken(item);

            setStatusDict(prev => ({
              ...prev,
              [item.id]: {
                status: 'pending',
                message: t('page.convertDust.status.pending'),
              },
            }));

            const activeProvider = await getActiveProvider({
              account: options.account,
              chain: options.chain,
              currentAddress: options.account.address,
              dexId,
              getSingleQuote,
              payToken: item,
              receiveToken: options.receiveToken,
              slippage: slippage,
            });

            throwIfTaskCancelled();

            // 获取报价失败
            if (!activeProvider) {
              throw new Error(
                t('page.convertDust.failReason.quoteUnavailable'),
              );
            }

            // gas 费用超过预设值
            if (
              !activeProvider.preExecResult ||
              new BigNumber(
                activeProvider.preExecResult.gasUsdValue,
              ).isGreaterThan(config.maxGasCost)
            ) {
              throw new Error(t('page.convertDust.failReason.gasCostTooHigh'));
            }

            const fromUsdBn = new BigNumber(item.amount || 0).times(
              item.price || 0,
            );
            const toUsdBn = new BigNumber(
              activeProvider.actualReceiveAmount || 0,
            ).times(options.receiveToken?.price || 0);

            if (fromUsdBn.gt(0)) {
              const priceImpact = toUsdBn
                .minus(fromUsdBn)
                .div(fromUsdBn)
                .times(100);

              // 价差过大
              if (priceImpact.lte(-priceImpactLimit)) {
                throw new Error(
                  t('page.convertDust.failReason.priceImpactTooHigh'),
                );
              }
            }

            const txs = await buildSwapTxs({
              account: options.account,
              payToken: item,
              receiveToken: options.receiveToken,
              quote: null,
              activeProvider,
              preferMEVGuarded: false,
              chain: options.chain.enum,
              inputAmount: getTokenRawAmount(item)
                .div(10 ** item.decimals)
                .toString(10),
              slippage: slippage,
              rbiSource: 'desktopSmallSwap',
              swapUseSlider: false,
            });

            throwIfTaskCancelled();

            // 构建交易数据失败
            if (!txs?.length) {
              throw new Error(t('page.convertDust.failReason.submitFailed'));
            }

            const result: {
              txHash: string;
              preExecResult?: ExplainTxResponse;
              isSimulationFailed?: boolean;
            } = { txHash: '' };

            throwIfTaskCancelled();

            // let pushType: TxPushType = 'default';
            // if ('swapPreferMEVGuarded' in tx) {
            //   if (tx.swapPreferMEVGuarded) {
            //     pushType = 'mev';
            //   }
            //   delete tx.swapPreferMEVGuarded;
            // }

            const txsArray = twoStepChains.includes(options.chain.enum)
              ? txs.map(tx => [tx])
              : [txs];

            for (const txsGroup of txsArray) {
              await prefetch({
                txs: txsGroup,
                onPreExecChange(p) {
                  result.preExecResult = p;
                },
                onPreExecError() {
                  result.isSimulationFailed = true;
                },
              });
              const res = await openDirect({
                txs: txsGroup,
                onPreExecError() {
                  result.isSimulationFailed = true;
                },
                isHideErrorUI: true,
                autoUseGasFree: true,
              });
              // const res = await new Promise<string[]>((resolve, _reject) => {
              //   setTimeout(() => {
              //     resolve([]);
              //   }, 10000);
              // });

              result.txHash = last(res) || '';
              if (result.txHash) {
                try {
                  await waitForTxCompleted({
                    hash: result.txHash,
                    chainServerId: options.chain.serverId,
                    isTaskCancelled,
                  });
                } catch (e) {
                  if ((e as any)?.name === TASK_CANCELLED_ERROR_NAME) {
                    throw e;
                  }

                  throw new Error(
                    t('page.convertDust.failReason.transactionFailed'),
                  );
                }
              }
            }

            // result = await sendTransaction({
            //   tx,
            //   ignoreGasCheck,
            //   wallet,
            //   chainServerId: options.chain.serverId,
            //   sig: gasAccount?.sig,
            //   autoUseGasAccount: true,
            //   pushType,
            //   onProgress: (status) => {
            //     if (isTaskCancelled()) {
            //       return;
            //     }

            //     if (status === 'builded') {
            //       setTxStatus('sended');
            //     } else if (status === 'signed') {
            //       setTxStatus('signed');
            //     }
            //   },
            //   ga: {
            //     category: 'Swap',
            //     source: 'swap',
            //   },
            // });
            throwIfTaskCancelled();
            // 预执行失败
            if (result.isSimulationFailed) {
              throw new Error(t('page.convertDust.failReason.submitFailed'));
            }
            // 提交交易失败
            if (!result?.txHash) {
              throw new Error(t('page.convertDust.failReason.submitFailed'));
            }

            throwIfTaskCancelled();

            setStatusDict(prev => ({
              ...prev,
              [item.id]: {
                status: 'success',
                createdAt: Date.now(),
                preExecResult: result!.preExecResult,
                actualReceiveAmount: activeProvider.actualReceiveAmount,
                txHash: result!.txHash,
                message: t('page.convertDust.status.success'),
              },
            }));
          } catch (e) {
            const error = e as any;
            if (error?.name === TASK_CANCELLED_ERROR_NAME) {
              return;
            }

            if (!isTaskCancelled()) {
              setStatusDict(prev => ({
                ...prev,
                [item.id]: {
                  status: 'failed',
                  message:
                    error === MINI_SIGN_ERROR.GAS_NOT_ENOUGH
                      ? t('page.convertDust.failReason.gasNotEnough')
                      : error?.message ||
                        t('page.convertDust.failReason.submitFailed'),
                  createdAt: Date.now(),
                },
              }));
            }
          } finally {
            if (!isTaskCancelled()) {
              setTxStatus('idle');
              closeSign();
            }
            // setCurrentToken(null);
          }
        },
        { priority },
      );
    },
  );

  const start = React.useCallback(() => {
    if (!list.length) {
      return;
    }

    updateStatus('active');

    for (const item of list) {
      addTask(item, 0);
    }
    if (queueRef.current.isPaused) {
      queueRef.current.start();
    }
  }, [addTask, list, updateStatus]);

  const init = React.useCallback(
    (dataSource: TokenItem[]) => {
      cancelRunningTasks();
      setList(dataSource);
      setStatusDict(
        dataSource.reduce((dict, item) => {
          dict[item.id] = {
            status: 'idle',
            message: t('page.convertDust.status.idle'),
          };
          return dict;
        }, {} as Record<string, TaskItemStatus>),
      );
      setTxStatus('idle');
      setCurrentToken(null);
      updateStatus('idle');
    },
    [cancelRunningTasks, t, updateStatus],
  );

  const pause = React.useCallback(() => {
    if (statusRef.current !== 'active') {
      return;
    }

    queueRef.current.pause();
    updateStatus('paused');
  }, [updateStatus]);

  const handleContinue = React.useCallback(() => {
    queueRef.current.start();
    updateStatus('active');
  }, [updateStatus]);

  React.useEffect(() => {
    queueRef.current.on('error', error => {
      console.error('Queue error:', error);
    });

    queueRef.current.on('idle', () => {
      if (statusRef.current === 'active' || statusRef.current === 'paused') {
        updateStatus('completed');
      }
    });

    return () => {
      cancelRunningTasks();
    };
  }, [cancelRunningTasks, updateStatus]);

  const expectReceiveUsd = useMemo(() => {
    return (list || []).reduce((sum, item) => {
      return sum + (item.amount * item.price || 0);
    }, 0);
  }, [list]);

  const expectReceiveAmount = useMemo(() => {
    if (!options.receiveToken?.price) {
      return '0';
    }
    return new BigNumber(expectReceiveUsd)
      .div(options.receiveToken.price)
      .toString(10);
  }, [expectReceiveUsd, options.receiveToken]);

  const finalReceive = useMemo(() => {
    let totalUsd = 0;
    let totalAmount = 0;

    Object.values(statusDict).forEach(item => {
      if (item.status === 'success') {
        if (
          item.preExecResult &&
          item.preExecResult.pre_exec_version !== 'v0' &&
          item.preExecResult.balance_change.success
        ) {
          item.preExecResult.balance_change?.receive_token_list?.forEach(
            token => {
              if (token.id === options.receiveToken?.id) {
                totalUsd += token.amount * token.price || 0;
                totalAmount += token.amount || 0;
              }
            },
          );
        } else {
          totalUsd +=
            (Number(item.actualReceiveAmount || 0) *
              (options.receiveToken?.price || 0) || 0) *
            (1 - Number(slippage) / 100);
          totalAmount +=
            (Number(item.actualReceiveAmount || 0) || 0) *
            (1 - Number(slippage) / 100);
        }
      }
    });
    return {
      usd: totalUsd,
      amount: totalAmount,
    };
  }, [
    statusDict,
    options.receiveToken?.id,
    options.receiveToken?.price,
    slippage,
  ]);

  const isSuccess = useMemo(() => {
    return (
      status === 'completed' &&
      !!Object.values(statusDict || {}).find(item => item.status === 'success')
    );
  }, [status, statusDict]);

  const currentTaskIndex = React.useMemo(() => {
    return list.findIndex(item => currentToken?.id === item.id);
  }, [list, currentToken]);

  const clear = useMemoizedFn(() => {
    cancelRunningTasks();
    setList([]);
    setStatusDict({});
    setTxStatus('idle');
    setCurrentToken(null);
    updateStatus('idle');
  });

  const stop = useMemoizedFn(() => {
    // cancelRunningTasks();
    // setList([]);
    setCurrentToken(null);
    updateStatus('completed');
  });

  const disabled = useMemo(() => {
    return status === 'active' || status === 'paused';
  }, [status]);

  return {
    statusDict,
    list,
    init,
    start,
    continue: handleContinue,
    pause,
    stop,
    status,
    txStatus,
    addTask,
    currentToken,
    currentTaskIndex,
    currentApprovalRef,
    clear,
    config,
    setConfig,
    expectReceive: {
      usd: expectReceiveUsd,
      amount: expectReceiveAmount,
    },
    finalReceive,
    disabled,
    isSuccess,
  };
};

export type BatchSwapTaskType = ReturnType<typeof useBatchSwapTask>;
