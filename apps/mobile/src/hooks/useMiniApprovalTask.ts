import { FailedCode, sendTransaction } from '@/utils/sendTransaction';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn, useRequest } from 'ahooks';
import _, { uniqueId } from 'lodash';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getRetryTxRecommendNonce,
  getRetryTxType,
  retryTxReset,
  setRetryTxRecommendNonce,
} from '@/utils/errorTxRetry';
import BigNumber from 'bignumber.js';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

type TxStatus = 'sended' | 'signed' | 'idle' | 'failed';

type ListItemType = {
  tx: Tx;
  options: Omit<
    Parameters<typeof sendTransaction>[0],
    'tx' | 'onProgress' | 'wallet'
  >;
  status: TxStatus;
  message?: string;
  hash?: string;
};

// Zustand implementation for taskList
type TaskListState = ListItemType[];
const taskListStore = zCreate<TaskListState>(() => []);

function setTaskListState(valOrFunc: UpdaterOrPartials<TaskListState>) {
  taskListStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

// Zustand implementation for taskStatus
type TaskStatusState = 'idle' | 'active' | 'paused' | 'completed';
const taskStatusStore = zCreate<TaskStatusState>(() => 'idle');

function setTaskStatusState(valOrFunc: UpdaterOrPartials<TaskStatusState>) {
  taskStatusStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

// Zustand implementation for taskError
type TaskErrorState = {
  status: 'REJECTED' | 'FAILED';
  content: string;
  description: string;
} | null;

const taskErrorStore = zCreate<TaskErrorState>(() => null);

function setTaskErrorState(valOrFunc: UpdaterOrPartials<TaskErrorState>) {
  taskErrorStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

// Zustand implementation for miniSignTxInfo
type MiniSignTxInfoState = {
  status: TaskStatusState;
  totalTxLength: number;
  error: TaskErrorState;
  currentActiveIndex: number;
};

const miniSignTxInfoStore = zCreate<MiniSignTxInfoState>(get => {
  const list = taskListStore.getState();
  const status = taskStatusStore.getState();
  const error = taskErrorStore.getState();
  const index = _.findLastIndex(list, item => item.status !== 'idle');
  return {
    status,
    totalTxLength: list.length,
    error,
    currentActiveIndex: index <= -1 ? 0 : index,
  };
});

export const useGetMiniSignInfo = () => miniSignTxInfoStore();

let globalCurrentTaskId = uniqueId();
export const useMiniApprovalTask = ({ ga }: { ga?: Record<string, any> }) => {
  const list = taskListStore();
  const status = taskStatusStore();
  const error = taskErrorStore();

  const { t } = useTranslation();

  const _updateList = useMemoizedFn(
    ({ index, payload }: { index: number; payload: Partial<ListItemType> }) => {
      setTaskListState(prev => {
        const cloned = [...prev];

        cloned[index] = {
          ...cloned[index],
          ...payload,
        };

        return cloned;
      });
    },
  );

  const init = useMemoizedFn((list: ListItemType[]) => {
    setTaskListState(list);
    setTaskStatusState('idle');
    setTaskErrorState(null);
    globalCurrentTaskId = uniqueId();
  });

  const retryTxs = useRef<ListItemType[]>([]);

  const { runAsync: start } = useRequest(
    async (isRetry = false) => {
      const currentId = globalCurrentTaskId;
      const resultList: Awaited<ReturnType<typeof sendTransaction>>[] = [];

      if (!isRetry) {
        retryTxs.current = [];
        retryTxReset();
      } else {
        if (!retryTxs.current.length) {
          retryTxs.current = list;
        }
      }

      try {
        setTaskStatusState('active');
        for (let index = 0; index < list.length; index++) {
          let item = list[index];

          if (item.status === 'signed') {
            continue;
          }

          if (isRetry) {
            item = retryTxs.current[index];
          }

          let tx = item.tx;
          const options = item.options;

          if (isRetry) {
            const retryType = getRetryTxType();
            switch (retryType) {
              case 'nonce': {
                const recommendNonce = getRetryTxRecommendNonce();
                tx.nonce = recommendNonce;
                break;
              }
              case 'gasPrice': {
                if (tx.gasPrice) {
                  tx.gasPrice = `0x${new BigNumber(
                    new BigNumber(tx.gasPrice, 16).times(1.3).toFixed(0),
                  ).toString(16)}`;
                }
                if (tx.maxFeePerGas) {
                  tx.maxFeePerGas = `0x${new BigNumber(
                    new BigNumber(tx.maxFeePerGas, 16).times(1.3).toFixed(0),
                  ).toString(16)}`;
                }
                break;
              }

              default:
                break;
            }

            if (retryType) {
              const tmp = [...list];
              tmp[index] = { ...item, tx: { ...tx } };
              retryTxs.current = tmp;
            }
          }

          try {
            const result = await sendTransaction({
              ...options,
              ga,
              tx,
              onProgress: status => {
                if (currentId !== globalCurrentTaskId) {
                  return;
                }
                if (status === 'builded') {
                  _updateList({
                    index,
                    payload: {
                      status: 'sended',
                    },
                  });
                } else if (status === 'signed') {
                  _updateList({
                    index,
                    payload: {
                      status: 'signed',
                    },
                  });
                }
              },
            });
            if (currentId !== globalCurrentTaskId) {
              throw new Error('different taskId');
            }
            _updateList({
              index,
              payload: {
                hash: result?.txHash,
              },
            });
            resultList.push(result);
          } catch (e: any) {
            console.error(e);
            if (currentId !== globalCurrentTaskId) {
              return;
            }
            const msg = e.message || e.name;
            _updateList({
              index,
              payload: {
                status: 'failed',
                message: msg,
              },
            });

            const _status =
              e.name === FailedCode.UserRejected ? 'REJECTED' : 'FAILED';

            retryTxReset();
            await setRetryTxRecommendNonce({
              from: tx.from,
              chainId: tx.chainId,
              account: options.account,
              nonce: tx.nonce,
            });

            setTaskErrorState({
              status: _status,
              content:
                _status === 'REJECTED'
                  ? t('page.signFooterBar.ledger.txRejected')
                  : t('page.signFooterBar.qrcode.txFailed'),
              description: msg,
            });
            // if (!(isLedgerLockError(msg) || msg === 'DISCONNECTED')) {
            //   setError(msg);
            // }
            throw e;
          }
        }

        retryTxReset();
        if (currentId !== globalCurrentTaskId) {
          return;
        }
        setTaskStatusState('completed');
        return resultList;
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    {
      manual: true,
    },
  );

  const handleRetry = useMemoizedFn(async () => {
    setTaskErrorState(null);
    return await start(true);
  });

  const stop = useMemoizedFn(() => {
    setTaskStatusState('idle');
  });

  const currentActiveIndex = React.useMemo(() => {
    const index = _.findLastIndex(list, item => item.status !== 'idle');
    return index <= -1 ? 0 : index;
  }, [list]);

  const txStatus = useMemo(() => {
    return list[currentActiveIndex]?.status;
  }, [list, currentActiveIndex]);

  const clear = useMemoizedFn(() => {
    return init([]);
  });

  return {
    list,
    init,
    start,
    retry: handleRetry,
    error,
    status,
    currentActiveIndex,
    total: list.length,
    txStatus,
    stop,
    clear,
  };
};

export const useClearMiniApprovalTask = () => {
  const clear = useMemoizedFn(() => {
    setTaskListState([]);
    setTaskStatusState('idle');
    setTaskErrorState(null);
    globalCurrentTaskId = uniqueId();
  });

  return {
    clear,
  };
};

export type MiniApprovalTaskType = ReturnType<typeof useMiniApprovalTask>;
