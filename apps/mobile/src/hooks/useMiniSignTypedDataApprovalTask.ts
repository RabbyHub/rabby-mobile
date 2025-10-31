import { FailedCode } from '@/utils/sendTransaction';
import { useMemoizedFn, useRequest } from 'ahooks';
import { atom, useAtom } from 'jotai';
import _, { uniqueId } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { sendSignTypedData } from '@/utils/sendTypedData';

type TxStatus = 'sended' | 'signed' | 'idle' | 'failed';

export type MiniTypedData = {
  data: Record<string, any>;
  from: string;
  version: 'V1' | 'V3' | 'V4';
};

type ListItemType = {
  tx: MiniTypedData;
  options: Omit<
    Parameters<typeof sendSignTypedData>[0],
    'tx' | 'onProgress' | 'wallet' | 'data' | 'from' | 'version'
  >;
  status: TxStatus;
  message?: string;
  hash?: string;
};

const taskListAtom = atom<ListItemType[]>([]);
const taskStatusAtom = atom<'idle' | 'active' | 'paused' | 'completed'>('idle');
const taskErrorAtom = atom<{
  status: 'REJECTED' | 'FAILED';
  content: string;
  description: string;
} | null>(null);

let globalCurrentTaskId = uniqueId();
export const useMiniTypedDataApprovalTask = ({
  ga,
}: {
  ga?: Record<string, any>;
}) => {
  const [list, setList] = useAtom(taskListAtom);
  const [status, setStatus] = useAtom(taskStatusAtom);
  const [error, setError] = useAtom(taskErrorAtom);

  const { t } = useTranslation();

  const _updateList = useMemoizedFn(
    ({ index, payload }: { index: number; payload: Partial<ListItemType> }) => {
      setList(prev => {
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
    setList(list);
    setStatus('idle');
    setError(null);
    globalCurrentTaskId = uniqueId();
  });

  const { runAsync: start } = useRequest(
    async (isRetry = false) => {
      const currentId = globalCurrentTaskId;
      const resultList: Awaited<ReturnType<typeof sendSignTypedData>>[] = [];

      try {
        setStatus('active');
        for (let index = 0; index < list.length; index++) {
          let item = list[index];

          if (item.status === 'signed') {
            continue;
          }

          let tx = item.tx;
          const options = item.options;

          try {
            const result = await sendSignTypedData({
              ...tx,
              ...options,
              ga,
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

            setError({
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

        if (currentId !== globalCurrentTaskId) {
          return;
        }
        setStatus('completed');
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
    setError(null);
    return await start(true);
  });

  const stop = useMemoizedFn(() => {
    setStatus('idle');
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

export const useClearMiniTypedDataApprovalTask = () => {
  const [, setList] = useAtom(taskListAtom);
  const [, setStatus] = useAtom(taskStatusAtom);
  const [, setError] = useAtom(taskErrorAtom);

  const clear = useMemoizedFn(() => {
    setList([]);
    setStatus('idle');
    setError(null);
    globalCurrentTaskId = uniqueId();
  });

  return {
    clear,
  };
};

export type MiniTypedDataApprovalTaskType = ReturnType<
  typeof useMiniTypedDataApprovalTask
>;
