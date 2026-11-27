import { useInfiniteScroll } from 'ahooks';
import React, { useCallback, useEffect, useState } from 'react';
import { uniqBy } from 'lodash';
import { openapi } from '@/core/request';
import useAsync from 'react-use/lib/useAsync';
import { atom, getDefaultStore, useSetAtom } from 'jotai';
import { useScopedActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { zCreate } from '@/core/utils/reexports';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { bridgeServiceApi } from '@/core/serviceApi/bridge';
import { getTransactionHistoryRecentPendingSnapshot } from '@/core/serviceApi/transactionHistory';
import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

const pendingCountAtom = atom(0);
const bridgeTxDataPendingAtom = atom<BridgeHistory | null>(null);
export const bridgeHistoryRedDotAtom = atom(false);

export const useClearBridgeHistoryRedDot = () => {
  const setBridgeHistoryRedDot = useSetAtom(bridgeHistoryRedDotAtom);

  const { finalSceneCurrentAccount: account } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  return useCallback(async () => {
    if (!account?.address) {
      return 0;
    }

    setBridgeHistoryRedDot(false);
    const currentTs = await bridgeServiceApi.getOpenBridgeHistoryTs(
      account.address,
    );
    await bridgeServiceApi.setOpenBridgeHistoryTs(account.address);
    return currentTs;
  }, [account?.address, setBridgeHistoryRedDot]);
};

export const fetchLocalBridgePendingTx = (address: string) => {
  return getTransactionHistoryRecentPendingSnapshot(
    address,
    'bridge',
  ) as BridgeTxHistoryItem;
};

type BridgePendingPollerSession = {
  address: string;
  remoteTimer?: ReturnType<typeof setTimeout>;
};

const bridgePendingPollerStore = zCreate<{
  localPending: BridgeTxHistoryItem | null;
}>(() => ({ localPending: null }));

const bridgeJotaiStore = getDefaultStore();

const sameBridgePending = (
  left: BridgeTxHistoryItem | null,
  right: BridgeTxHistoryItem | null,
) => {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.hash === right.hash &&
    left.status === right.status &&
    (left as { updated_at?: number }).updated_at ===
      (right as { updated_at?: number }).updated_at &&
    (left as { modified_at?: number }).modified_at ===
      (right as { modified_at?: number }).modified_at
  );
};

function setBridgePendingLocal(next: BridgeTxHistoryItem | null) {
  const current = bridgePendingPollerStore.getState().localPending;
  if (sameBridgePending(current, next)) return;
  bridgePendingPollerStore.setState({ localPending: next });
}

let bridgePendingPoller: BridgePendingPollerSession | null = null;

async function pollBridgePendingRemote(session: BridgePendingPollerSession) {
  const data = await openapi.getBridgeHistoryList({
    user_addr: session.address,
    start: 0,
    limit: 10,
    is_all: true,
  });
  if (bridgePendingPoller !== session) return;

  const openModalTs = await bridgeServiceApi.getOpenBridgeHistoryTs(
    session.address,
  );
  if (bridgePendingPoller !== session) return;
  const ts = data?.history_list
    ?.filter(item => item?.status !== 'pending')
    .sort((a, b) => b.create_at - a.create_at);
  const latestCreateAt = ts?.[0]?.create_at;
  if (openModalTs) {
    bridgeJotaiStore.set(
      bridgeHistoryRedDotAtom,
      latestCreateAt != null && latestCreateAt > openModalTs / 1000,
    );
  } else {
    await bridgeServiceApi.setOpenBridgeHistoryTs(session.address);
  }
  bridgeJotaiStore.set(
    pendingCountAtom,
    data?.history_list?.filter(item => item?.status === 'pending')?.length || 0,
  );
}

/** Module-level poller: periodic requests must not live in a React component. */
export function startBridgePendingPolling(address: string, timer: number) {
  if (bridgePendingPoller?.address === address) return;
  stopBridgePendingPolling();
  const session: BridgePendingPollerSession = { address };
  bridgePendingPoller = session;
  bridgeJotaiStore.set(bridgeTxDataPendingAtom, null);
  setBridgePendingLocal(fetchLocalBridgePendingTx(address));

  const runRemote = async () => {
    if (bridgePendingPoller !== session) return;
    try {
      await pollBridgePendingRemote(session);
    } catch {
      // keep the previous snapshot; the next tick retries
    }
    if (bridgePendingPoller === session) {
      session.remoteTimer = setTimeout(runRemote, timer);
    }
  };
  void runRemote();
}

export function stopBridgePendingPolling() {
  if (!bridgePendingPoller) return;
  clearTimeout(bridgePendingPoller.remoteTimer);
  bridgePendingPoller = null;
}

export function refreshBridgePendingRemote() {
  if (!bridgePendingPoller) return;
  void pollBridgePendingRemote(bridgePendingPoller).catch(() => undefined);
}

export function refreshBridgePendingLocal() {
  if (!bridgePendingPoller) return;
  setBridgePendingLocal(fetchLocalBridgePendingTx(bridgePendingPoller.address));
}

export function clearBridgePendingLocal() {
  setBridgePendingLocal(null);
}

export const usePollBridgePendingNumber = (timer = 10000, enabled = true) => {
  const { finalSceneCurrentAccount: account } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const address = account?.address;

  useEffect(() => {
    if (!enabled || !address) {
      stopBridgePendingPolling();
      return;
    }
    startBridgePendingPolling(address, timer);
    return () => {
      stopBridgePendingPolling();
    };
  }, [address, enabled, timer]);

  const localPendingTxData = useScopedActivityStore(
    enabled,
    bridgePendingPollerStore,
    state => state.localPending,
    Object.is,
    { storeLabel: 'bridge-pending' },
  );
  const setBridgeHistoryRedDot = useSetAtom(bridgeHistoryRedDotAtom);
  const clearBridgeHistoryRedDot = useCallback(async () => {
    setBridgeHistoryRedDot(false);
    if (!address) return 0;
    const currentTs = await bridgeServiceApi.getOpenBridgeHistoryTs(address);
    await bridgeServiceApi.setOpenBridgeHistoryTs(address);
    return currentTs;
  }, [address, setBridgeHistoryRedDot]);

  return {
    runAsync: refreshBridgePendingRemote,
    localPendingTxData,
    clearLocalPendingTxData: clearBridgePendingLocal,
    runFetchLocalPendingTx: refreshBridgePendingLocal,
    setBridgeHistoryRedDot,
    clearBridgeHistoryRedDot,
  };
};

const BRIDGE_HISTORY_PAGE_SIZE = 20;

const bridgeHistoryKey = (item: BridgeHistory) =>
  `${item.from_token.chain}:${item.from_tx.tx_id.toLowerCase()}`;

export const useBridgeHistory = (enabled = true) => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const addr = currentAccount?.address || '';

  const [refreshTxListCount, setRefreshListTx] = useState(0);
  const refreshBridgeListTx = React.useCallback(() => {
    setRefreshListTx(e => e + 1);
  }, []);
  // 暂停请求和计时，保留已加载分页供恢复时继续使用。
  const isInBridge = enabled;

  const getBridgeHistoryList = React.useCallback(
    async (address: string, start = 0, limit = BRIDGE_HISTORY_PAGE_SIZE) => {
      if (!isInBridge || !address) {
        return {
          list: [] as BridgeHistory[],
          last: undefined,
          totalCount: 0,
          nextStart: start,
        };
      }
      const data = await openapi.getBridgeHistoryList({
        user_addr: address,
        start: start,
        limit: limit,
        is_all: true,
      });
      return {
        list: data?.history_list,
        last: data,
        totalCount: data?.total_cnt,
        // 后端按数据库行 offset，返回前会丢掉无法展示的行。
        // 下一页必须按本次请求的行数推进，不能用已经展示的条数。
        nextStart: start + limit,
      };
    },
    [isInBridge],
  );

  const {
    data: txList,
    loading,
    loadMore,
    loadingMore,
    noMore,
    mutate,
  } = useInfiniteScroll(
    async d => {
      const page = await getBridgeHistoryList(
        addr,
        d?.nextStart ?? 0,
        BRIDGE_HISTORY_PAGE_SIZE,
      );
      if (!d?.list?.length || !page.list?.length) {
        return page;
      }
      const seen = new Set(d.list.map(bridgeHistoryKey));
      return {
        ...page,
        list: page.list.filter(item => !seen.has(bridgeHistoryKey(item))),
      };
    },
    {
      reloadDeps: [addr],
      isNoMore(data) {
        if (!data || typeof data.totalCount !== 'number') {
          return !data;
        }
        return (data.nextStart ?? 0) >= data.totalCount;
      },
      manual: !isInBridge || !addr,
    },
  );

  // 恢复时立即刷新首页，并与已有分页合并。
  const { value } = useAsync(async () => {
    if (addr && isInBridge) {
      return getBridgeHistoryList(addr, 0, BRIDGE_HISTORY_PAGE_SIZE);
    }
  }, [addr, refreshTxListCount, isInBridge]);

  useEffect(() => {
    if (isInBridge && value?.list) {
      mutate(d => {
        if (!d) {
          return value;
        }
        return {
          last: d?.last,
          totalCount: value.totalCount ?? d?.totalCount,
          nextStart: d.nextStart,
          list: uniqBy(
            [...(value.list || []), ...(d?.list || [])],
            bridgeHistoryKey,
          ),
        };
      });
    }
  }, [mutate, value, isInBridge]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      !loading &&
      !loadingMore &&
      txList?.list?.some(e => e.status === 'pending') &&
      isInBridge
    ) {
      timer = setTimeout(refreshBridgeListTx, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [loading, loadingMore, refreshBridgeListTx, txList?.list, isInBridge]);

  return {
    loading,
    txList,
    loadingMore,
    loadMore,
    noMore,
  };
};
