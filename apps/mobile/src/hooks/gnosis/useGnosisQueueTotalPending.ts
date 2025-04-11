import { useMemoizedFn } from 'ahooks';
import { sum } from 'lodash';
import { useMemo } from 'react';
import { useGnosisPendingMessages } from './useGnosisPendingMessages';
import { useGnosisPendingTxs } from './useGnosisPendingTxs';

export const useGnosisQueueTotalPending = (params: { address?: string }) => {
  const { data: pendingTxs, refreshAsync: refreshTxs } =
    useGnosisPendingTxs(params);

  const { data: messages, refreshAsync: refreshMessages } =
    useGnosisPendingMessages(params);

  const total = useMemo(() => {
    return sum([pendingTxs?.total, messages?.total].map(item => item || 0));
  }, [pendingTxs?.total, messages?.total]);

  const refreshAsync = useMemoizedFn(() => {
    refreshTxs();
    refreshMessages();
  });

  return {
    pendingTxs,
    messages,
    total,
    refreshAsync,
  };
};
