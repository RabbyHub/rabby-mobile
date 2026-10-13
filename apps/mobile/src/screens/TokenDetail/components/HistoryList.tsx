import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme2024 } from '@/hooks/theme';
import type { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { createGetStyles2024 } from '@/utils/styles';
import { useInfiniteScroll, useMemoizedFn } from 'ahooks';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import {
  ensureHistoryListItemFromDb,
  fetchHistoryTokenItem,
  getHistoryItemType,
} from '@/screens/Transaction/components/utils';
import { useTranslation } from 'react-i18next';
import {
  HistoryList,
  type HistoryListHeaderComponent,
} from '@/screens/Transaction/components/HistoryGroupList';
import {
  getTransactionHistorySucceedListSnapshot,
  getTransactionHistoryTransactions,
  transactionHistoryServiceApi,
} from '@/core/serviceApi/transactionHistory';
import { openapi } from '@/core/request';
import type {
  TxAllHistoryResult,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { debounce, last, orderBy } from 'lodash';
import { toast } from '@/components2024/Toast';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { Empty } from '@/screens/Transaction/components/Empty';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/src/types';
import {
  HistoryItemEntity,
  toHistoryPageCursor,
  type HistoryPageCursor,
} from '@/databases/entities/historyItem';
import type { ITokenItem } from '@/store/tokens';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  useTransactionHistoryServiceReady,
  withTransactionHistoryService,
} from '@/core/serviceApi/transactionHistoryHooks';

interface IFetchHistory {
  last: number;
  // keyset cursor for local DB pages; `last` stays the remote API start_time
  dbCursor?: HistoryPageCursor;
  list: HistoryDisplayItem[];
}

const PAGE_COUNT = 20;

const TokenDetailHistoryListContent = ({
  finalAccount,
  token,
  onRefresh,
  onReachTopStatusChange,
  ListHeaderComponent,
  baseTokenRefreshing,
  disableHistoryRequest,
  overWritePlaceholder,
}: {
  finalAccount: KeyringAccountWithAlias | null;
  token: ITokenItem;
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
  ListHeaderComponent?: HistoryListHeaderComponent;
  baseTokenRefreshing?: boolean;
  disableHistoryRequest?: boolean;
  overWritePlaceholder?: string;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { isSceneUsingAllAccounts, sceneCurrentAccountDepKey } =
    useSceneAccountInfo({
      forScene: 'TokenDetail',
    });
  const tokenItem = token;
  const currentAddress = finalAccount?.address;

  const isReady = useRef(false);
  const requestPendingRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const lastMap = useRef<Record<string, number>>({});
  const dbCursorRef = useRef<HistoryPageCursor | null>(null);
  const hasMoreMap = useRef<Record<string, boolean>>({});

  const [historySuccessList, setHistorySuccessList] = useState<string[]>(
    getTransactionHistorySucceedListSnapshot(),
  );
  const transactionHistoryReady = useTransactionHistoryServiceReady();
  const hasConsumedLocalStatusRef = useRef(false);

  const historyListRef = useRef<{ scrollToTop: () => void }>(null);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onReachTopStatusChange?.(event.nativeEvent.contentOffset.y <= 0);
    },
    [onReachTopStatusChange],
  );

  const fetchData = async (
    address: string,
    startTime = 0,
    chain_id: string,
    token_id: string,
    isMyAddress?: boolean,
    dbCursor: HistoryPageCursor | null = null,
  ): Promise<IFetchHistory> => {
    if (!address) {
      throw new Error('no account');
    }

    if (isMyAddress) {
      const historyList =
        await HistoryItemEntity.getTokenHistoryItemSortedByTime(
          address,
          dbCursor,
          token_id,
          chain_id,
          PAGE_COUNT,
        );
      const list = historyList.map(item => {
        return {
          ...ensureHistoryListItemFromDb(item),
          // hidden small and scam no need this prop
          isSmallUsdTx: false,
          isShowSuccess: false,
        } as HistoryDisplayItem;
      });
      const lastItem = last(historyList);
      return {
        last: lastItem?.time_at || 0,
        dbCursor: lastItem ? toHistoryPageCursor(lastItem) : undefined,
        list,
      };
    } else {
      const [res, transactions] = await Promise.all([
        openapi.listTxHistory({
          id: address,
          start_time: startTime,
          page_count: PAGE_COUNT,
          chain_id,
          token_id,
        }),
        getTransactionHistoryTransactions(),
      ]);

      const { project_dict, history_list: list } = res;
      const token_dict = (res as TxHistoryResult).token_dict;
      const token_uuid_dict = (res as unknown as TxAllHistoryResult)
        .token_uuid_dict;
      const tokenDict = token_dict || token_uuid_dict;

      const displayList = list
        .map(item => ({
          ...item,
          address,
          key: `${address}_${item.chain}_${item.id}`,
          project_item: project_dict[item.project_id || ''] || null,
          token_approve: item.token_approve
            ? {
                ...item.token_approve,
                token: fetchHistoryTokenItem(
                  item.token_approve?.token_id || '',
                  item.chain,
                  tokenDict,
                ),
              }
            : null,
          receives: item.receives.map(e => ({
            ...e,
            token: fetchHistoryTokenItem(e.token_id, item.chain, tokenDict),
          })),
          sends: item.sends.map(e => ({
            ...e,
            token: fetchHistoryTokenItem(e.token_id, item.chain, tokenDict),
          })),
          historyType: getHistoryItemType(item, transactions),
        }))
        .sort((v1, v2) => v2.time_at - v1.time_at);
      return {
        last: last(displayList)?.time_at || 0,
        list: displayList,
      };
    }
  };

  const isMyAddress = useMemo(() => {
    return (
      finalAccount?.type !== KEYRING_CLASS.WATCH &&
      finalAccount?.type !== KEYRING_CLASS.GNOSIS
    );
  }, [finalAccount]);

  const batchFetchData = useMemoizedFn(async (isReload: boolean) => {
    const requestSequence = ++requestSequenceRef.current;
    const list: HistoryDisplayItem[] = [];
    if (disableHistoryRequest) {
      return {
        list,
        hasMore: false,
      };
    }

    const account = finalAccount;
    if (!account) {
      return {
        list: [],
        hasMore: false,
      };
    }
    const addr = account.address.toLowerCase();
    if (!isReload && hasMoreMap.current[addr] === false) {
      return {
        list: [],
        hasMore: false,
      };
    }

    const result = await fetchData(
      addr,
      isReload ? 0 : lastMap.current[addr] || 0,
      tokenItem.chain,
      tokenItem.id,
      isMyAddress,
      isReload ? null : dbCursorRef.current,
    );
    if (requestSequence !== requestSequenceRef.current) {
      // ahooks cancels request callbacks, but useInfiniteScroll publishes its
      // service result before that cancellation check. Do not fulfill a page
      // superseded by a refresh, or it can overwrite the refreshed list/cursor.
      throw new Error('Superseded token history page');
    }
    if (result.list.length < PAGE_COUNT) {
      hasMoreMap.current[addr] = false;
    } else {
      hasMoreMap.current[addr] = true;
    }
    lastMap.current[addr] = result.last || 0;
    dbCursorRef.current = result.dbCursor ?? null;
    list.push(
      ...result.list.map(item => {
        return {
          ...item,
          account,
        };
      }),
    );

    if (!isReady.current) {
      isReady.current = true;
    }
    return {
      list: orderBy(list, 'time_at', 'desc'),
      hasMore: Object.values(hasMoreMap.current).some(item => item),
    };
  });

  const {
    data: fetchApiData,
    loading,
    loadingMore,
    loadMore,
    noMore,
    reload,
    cancel,
  } = useInfiniteScroll(lastData => batchFetchData(!lastData), {
    isNoMore: d => disableHistoryRequest || (d ? !d.hasMore : false),
    // Native lists can report their end repeatedly before React commits the
    // loading flags. Reserve the request synchronously as well.
    onBefore() {
      requestPendingRef.current = true;
    },
    onFinally() {
      requestPendingRef.current = false;
    },
    onError(error) {
      // Only the current request reports failures. Rejecting the page leaves
      // the visible rows intact; cancellation suppresses stale error toasts.
      toast.error(`${currentAddress} fetch failed, ${error}`);
    },
  });

  const refresh = useMemoizedFn(() => {
    cancel();
    if (!disableHistoryRequest) {
      // Read the first page without discarding committed cursors. A failed
      // refresh must still allow appending/retrying from the displayed window.
      reload();
    }
    onRefresh?.();
  });

  useEffect(() => {
    if (isReady.current) {
      cancel();
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneCurrentAccountDepKey, isSceneUsingAllAccounts]);

  const batchFetchDataFromDbUpsert = useMemoizedFn(async () => {
    reload();
  });

  const throttleBatchFetchData = useMemo(
    () =>
      debounce(batchFetchDataFromDbUpsert, 1000, {
        leading: true,
        trailing: true,
      }),
    [batchFetchDataFromDbUpsert],
  );

  useEffect(() => {
    return () => {
      throttleBatchFetchData.cancel();
    };
  }, [throttleBatchFetchData]);

  useEffect(() => {
    if (!transactionHistoryReady || hasConsumedLocalStatusRef.current) {
      return;
    }
    hasConsumedLocalStatusRef.current = true;
    const list = getTransactionHistorySucceedListSnapshot();
    setHistorySuccessList(list);
    void transactionHistoryServiceApi
      .clearSuccessAndFailList(currentAddress)
      .catch(error => {
        console.error('[TokenHistory] clear local status failed', error);
      });
  }, [currentAddress, transactionHistoryReady]);

  const displayList = useMemo(() => {
    return (
      fetchApiData?.list.filter(tx => {
        const shouldShowBasedOnType = !tx.is_scam;
        return shouldShowBasedOnType;
      }) || []
    );
  }, [fetchApiData]);

  return (
    <HistoryList
      ref={historyListRef}
      historySuccessList={historySuccessList}
      list={displayList}
      loading={false}
      isNeedFetchFromApi={!isMyAddress}
      firstFetchDone={false}
      loadingMore={loadingMore}
      refreshLoading={loading || baseTokenRefreshing}
      isForMultipleAddress={false}
      account={finalAccount}
      appendBottom={300}
      style={styles.overwriteListContainer}
      moreLoadingLength={5}
      ListHeaderComponent={ListHeaderComponent}
      emptyComponent={
        !loading && !displayList.length && noMore ? (
          <Empty
            style={styles.emptyStyle}
            title={
              overWritePlaceholder
                ? overWritePlaceholder
                : !isMyAddress
                ? t('page.activities.signedTx.empty.title')
                : t('page.activities.signedTx.empty.titleLastThreeMonths')
            }
          />
        ) : null
      }
      onScroll={handleScroll}
      scrollEventThrottle={16}
      loadMore={() => {
        if (
          requestPendingRef.current ||
          loading ||
          loadingMore ||
          noMore ||
          !fetchApiData?.hasMore
        ) {
          return;
        }
        loadMore();
      }}
      onRefresh={refresh}
    />
  );
};

const TokenDetailHistoryListForScope = (
  props: React.ComponentProps<typeof TokenDetailHistoryListContent>,
) => {
  // Pagination and in-flight completions belong to exactly one account/token
  // scope. Remount that local state instead of publishing an old scope's page
  // into the next one when its DB/API request resolves late.
  const requestKey = JSON.stringify([
    props.finalAccount?.address.toLowerCase(),
    props.finalAccount?.type,
    props.token.chain,
    props.token.id,
    !!props.disableHistoryRequest,
  ]);
  return <TokenDetailHistoryListContent key={requestKey} {...props} />;
};

export const TokenDetailHistoryList = withTransactionHistoryService(
  TokenDetailHistoryListForScope,
);

const getStyle = createGetStyles2024(ctx => ({
  overwriteListContainer: {
    paddingHorizontal: 12,
  },
  emptyStyle: {
    height: 150,
  },
}));
