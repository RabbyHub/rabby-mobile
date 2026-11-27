import { openapi } from '@/core/request';
import type { SwapItem } from '@rabby-wallet/rabby-api/dist/types';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import {
  atom,
  getDefaultStore,
  useAtom,
  useAtomValue,
  useSetAtom,
} from 'jotai';
import { useScopedActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { zCreate } from '@/core/utils/reexports';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useRef } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { refreshIdAtom } from './atom';
import { swapServiceApi } from '@/core/serviceApi/swap';
import {
  getTransactionHistoryRecentPendingSnapshot,
  getTransactionHistoryRecentTxSnapshot,
} from '@/core/serviceApi/transactionHistory';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import type {
  SwapTxHistoryItem,
  SendTxHistoryItem,
} from '@/core/services/transactionHistory';
const swapTxHistoryVisibleAtom = atom(false);

export const useSwapTxHistoryVisible = () => {
  const [visible, setVisible] = useAtom(swapTxHistoryVisibleAtom);
  return {
    visible,
    setVisible,
  };
};

const SWAP_HISTORY_PAGE_SIZE = 20;

const swapHistoryKey = (item: SwapItem) =>
  `${item.chain}:${item.tx_id.toLowerCase()}`;

const getSwapList = async (
  addr: string,
  start = 0,
  limit = SWAP_HISTORY_PAGE_SIZE,
) => {
  const data = await openapi.getSwapTradeList({
    user_addr: addr,
    start: `${start}`,
    limit: `${limit}`,
  });
  return {
    list: data?.history_list,
    last: data,
    totalCount: data?.total_cnt,
    // 后端按数据库行 offset，返回前会丢掉无法展示的行。
    // 下一页必须按本次请求的行数推进，不能用已经展示的条数。
    nextStart: start + limit,
  };
};

export const useSwapHistory = (enabled = true) => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const addr = currentAccount?.address || '';

  const refreshSwapTxListCount = useAtomValue(refreshIdAtom);
  const refreshSwapListTx = useSetAtom(refreshIdAtom);

  if (!addr) {
    throw new Error('no addr');
  }

  const {
    data: txList,
    loading,
    loadMore,
    loadingMore,
    noMore,
    mutate,
    reload,
  } = useInfiniteScroll(
    async d => {
      const page = await getSwapList(
        addr,
        d?.nextStart ?? 0,
        SWAP_HISTORY_PAGE_SIZE,
      );
      if (!d?.list?.length || !page.list?.length) {
        return page;
      }
      const seen = new Set(d.list.map(swapHistoryKey));
      return {
        ...page,
        list: page.list.filter(item => !seen.has(swapHistoryKey(item))),
      };
    },
    {
      isNoMore(data) {
        if (!data || typeof data.totalCount !== 'number') {
          return !data;
        }
        return (data.nextStart ?? 0) >= data.totalCount;
      },
      // Keep the previous page while the history sheet is closed; only the
      // first visible-open reloads it.
      manual: !addr || !enabled,
    },
  );

  const wasEnabledRef = useRef(enabled);
  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      reload();
    }
    wasEnabledRef.current = enabled;
  }, [enabled, reload]);

  // The refresh path only needs the extra first-page read when the refresh id
  // or the account changes. The initial mount and the sheet-open transition
  // are already covered by useInfiniteScroll/reload; running this too would
  // duplicate the same page request.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const didMountRefreshRef = useRef(false);
  const { value } = useAsync(async () => {
    if (!didMountRefreshRef.current) {
      didMountRefreshRef.current = true;
      return;
    }
    if (!addr || !enabledRef.current) {
      return;
    }
    return getSwapList(addr, 0, SWAP_HISTORY_PAGE_SIZE);
  }, [addr, refreshSwapTxListCount]);

  useEffect(() => {
    if (value?.list) {
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
            swapHistoryKey,
          ),
        };
      });
    }
  }, [mutate, value]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      !loading &&
      !loadingMore &&
      txList?.list?.some(e => e.status !== 'Finished')
    ) {
      timer = setTimeout(refreshSwapListTx, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [loading, loadingMore, txList?.list, refreshSwapListTx]);

  return {
    loading,
    txList,
    loadingMore,
    loadMore,
    noMore,
    reload,
  };
};

export const swapPendingTxDataAtom = atom<SwapItem | null>(null);
export const swapHistoryRedDotAtom = atom(false);

export const fetchLocalSwapPendingTx = (address: string) => {
  return getTransactionHistoryRecentPendingSnapshot(
    address,
    'swap',
  ) as SwapTxHistoryItem;
};

export const fetchRefreshLocalData = (
  data: SwapTxHistoryItem | SendTxHistoryItem,
  type: 'swap' | 'send',
) => {
  if (data.status !== 'pending') {
    // has done
    return;
  }

  const address = data.address;
  const chainId = data.chainId;
  const hash = data.hash;
  const newData = getTransactionHistoryRecentTxSnapshot(
    address,
    hash,
    chainId,
    type,
  );

  if (newData?.status !== 'pending') {
    return newData;
  }
};

export const useClearSwapHistoryRedDot = () => {
  const setSwapHistoryRedDot = useSetAtom(swapHistoryRedDotAtom);
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  return useCallback(async () => {
    if (!currentAccount?.address) {
      return 0;
    }

    setSwapHistoryRedDot(false);
    const currentTs = await swapServiceApi.getOpenSwapHistoryTs(
      currentAccount.address,
    );
    await swapServiceApi.setOpenSwapHistoryTs(currentAccount.address);
    return currentTs;
  }, [currentAccount?.address, setSwapHistoryRedDot]);
};

type SwapPendingPollerSession = {
  address: string;
  remoteTimer?: ReturnType<typeof setTimeout>;
  localTimer?: ReturnType<typeof setTimeout>;
};

const swapPendingPollerStore = zCreate<{
  localPending: SwapTxHistoryItem | SendTxHistoryItem | null;
}>(() => ({ localPending: null }));

const jotaiStore = getDefaultStore();

const samePending = (
  left: SwapTxHistoryItem | SendTxHistoryItem | null,
  right: SwapTxHistoryItem | SendTxHistoryItem | null,
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

function setSwapPendingLocal(
  next: SwapTxHistoryItem | SendTxHistoryItem | null,
) {
  const current = swapPendingPollerStore.getState().localPending;
  if (samePending(current, next)) return;
  swapPendingPollerStore.setState({ localPending: next });
}

let swapPendingPoller: SwapPendingPollerSession | null = null;

async function pollSwapPendingRemote(session: SwapPendingPollerSession) {
  const data = await openapi.getSwapTradeList({
    user_addr: session.address,
    start: '0',
    limit: '20',
  });
  if (swapPendingPoller !== session) return;

  const txData = data?.history_list
    ?.filter(item => item?.status === 'Pending')
    .sort((a, b) => b.create_at - a.create_at);

  const openModalTs = await swapServiceApi.getOpenSwapHistoryTs(
    session.address,
  );
  if (swapPendingPoller !== session) return;
  const ts = data?.history_list
    ?.filter(item => item?.status !== 'Pending')
    .sort((a, b) => b.finished_at - a.finished_at);
  if (openModalTs) {
    jotaiStore.set(
      swapHistoryRedDotAtom,
      Boolean(ts?.[0]?.finished_at > openModalTs / 1000),
    );
  } else {
    await swapServiceApi.setOpenSwapHistoryTs(session.address);
  }
  jotaiStore.set(swapPendingTxDataAtom, txData?.[0] || null);
}

function pollSwapPendingLocal(session: SwapPendingPollerSession) {
  if (swapPendingPoller !== session) return;
  const local = swapPendingPollerStore.getState().localPending;
  if (local) {
    const next = fetchRefreshLocalData(local, 'swap') as SwapTxHistoryItem;
    if (next) {
      setSwapPendingLocal(next);
      jotaiStore.set(swapHistoryRedDotAtom, true);
    }
  }
  session.localTimer = setTimeout(() => pollSwapPendingLocal(session), 1000);
}

/** Module-level poller: periodic requests must not live in a React component. */
export function startSwapPendingPolling(address: string, timer: number) {
  if (swapPendingPoller?.address === address) return;
  stopSwapPendingPolling();
  const session: SwapPendingPollerSession = { address };
  swapPendingPoller = session;
  setSwapPendingLocal(fetchLocalSwapPendingTx(address));

  const runRemote = async () => {
    if (swapPendingPoller !== session) return;
    try {
      await pollSwapPendingRemote(session);
    } catch {
      // keep the previous snapshot; the next tick retries
    }
    if (swapPendingPoller === session) {
      session.remoteTimer = setTimeout(runRemote, timer);
    }
  };
  void runRemote();
  session.localTimer = setTimeout(() => pollSwapPendingLocal(session), 1000);
}

export function stopSwapPendingPolling() {
  if (!swapPendingPoller) return;
  clearTimeout(swapPendingPoller.remoteTimer);
  clearTimeout(swapPendingPoller.localTimer);
  swapPendingPoller = null;
}

export function refreshSwapPendingRemote() {
  if (!swapPendingPoller) return;
  void pollSwapPendingRemote(swapPendingPoller).catch(() => undefined);
}

export function refreshSwapPendingLocal() {
  if (!swapPendingPoller) return;
  setSwapPendingLocal(fetchLocalSwapPendingTx(swapPendingPoller.address));
}

export function clearSwapPendingLocal() {
  setSwapPendingLocal(null);
}

export const usePollSwapPendingNumber = (timer = 10000, enabled = true) => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const address = currentAccount?.address;

  useEffect(() => {
    if (!enabled || !address) {
      stopSwapPendingPolling();
      return;
    }
    startSwapPendingPolling(address, timer);
    return () => {
      stopSwapPendingPolling();
    };
  }, [address, enabled, timer]);

  const localPendingTxData = useScopedActivityStore(
    enabled,
    swapPendingPollerStore,
    state => state.localPending,
    Object.is,
    { storeLabel: 'swap-pending' },
  );
  const setSwapHistoryRedDot = useSetAtom(swapHistoryRedDotAtom);
  const clearSwapHistoryRedDot = useCallback(async () => {
    setSwapHistoryRedDot(false);
    if (!address) return 0;
    const currentTs = await swapServiceApi.getOpenSwapHistoryTs(address);
    await swapServiceApi.setOpenSwapHistoryTs(address);
    return currentTs;
  }, [address, setSwapHistoryRedDot]);

  return {
    runAsync: refreshSwapPendingRemote,
    localPendingTxData,
    clearLocalPendingTxData: clearSwapPendingLocal,
    runFetchLocalPendingTx: refreshSwapPendingLocal,
    setSwapHistoryRedDot,
    clearSwapHistoryRedDot,
    loading: false,
    error: undefined,
    data: localPendingTxData,
  };
};
