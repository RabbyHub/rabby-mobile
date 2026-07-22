import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn, useMount } from 'ahooks';
import { KeyringAccountWithAlias } from '@/hooks/account';
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
import { transactionHistoryService } from '@/core/services';
import { openapi } from '@/core/request';
import {
  TxAllHistoryResult,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { debounce, last, orderBy } from 'lodash';
import { toast } from '@/components2024/Toast';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { Empty } from '@/screens/Transaction/components/Empty';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/src/types';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { ITokenItem } from '@/store/tokens';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { syncSingleAddress } from '@/databases/hooks/history';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';

interface IFetchHistory {
  last: number;
  list: HistoryDisplayItem[];
}

const PAGE_COUNT = 20;

type TokenHistoryData = {
  list: HistoryDisplayItem[];
  hasMore: boolean;
};

type TokenHistoryPage = TokenHistoryData & {
  last: number;
};

export const TokenDetailHistoryList = ({
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
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const cursorRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const firstFetchDoneRef = useRef(false);
  const [historyData, setHistoryData] = useState<TokenHistoryData>({
    list: [],
    hasMore: true,
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [firstFetchDone, setFirstFetchDone] = useState(false);

  const [historySuccessList, setHistorySuccessList] = useState<string[]>(
    transactionHistoryService.getSucceedList(),
  );

  const historyListRef = useRef<{ scrollToTop: () => void }>(null);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestSeqRef.current += 1;
    };
  }, []);

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
  ): Promise<IFetchHistory> => {
    if (!address) {
      throw new Error('no account');
    }

    try {
      if (isMyAddress) {
        const historyList =
          await HistoryItemEntity.getTokenHistoryItemSortedByTime(
            address,
            startTime,
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
        return {
          last: last(historyList)?.time_at || 0,
          list,
        };
      } else {
        const res = await openapi.listTxHisotry({
          id: address,
          start_time: startTime,
          page_count: PAGE_COUNT,
          chain_id,
          token_id,
        });

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
            historyType: getHistoryItemType(item),
          }))
          .sort((v1, v2) => v2.time_at - v1.time_at);
        return {
          last: last(displayList)?.time_at || 0,
          list: displayList,
        };
      }
    } catch (e) {
      toast.error(`${address} fetch failed, ${e}`);
      return {
        last: 0,
        list: [],
      };
    }
  };

  const isMyAddress = useMemo(() => {
    if (!finalAccount) {
      return false;
    }
    return (
      finalAccount?.type !== KEYRING_CLASS.WATCH &&
      finalAccount?.type !== KEYRING_CLASS.GNOSIS
    );
  }, [finalAccount]);

  const requestKey = useMemo(
    () =>
      [
        currentAddress?.toLowerCase() || '',
        tokenItem.chain,
        tokenItem.id,
        isMyAddress ? 'db' : 'api',
      ].join(':'),
    [currentAddress, isMyAddress, tokenItem.chain, tokenItem.id],
  );

  const setLoadingState = useMemoizedFn((next: boolean) => {
    loadingRef.current = next;
    if (!mountedRef.current) {
      return;
    }
    setLoading(next);
  });

  const setLoadingMoreState = useMemoizedFn((next: boolean) => {
    loadingMoreRef.current = next;
    if (!mountedRef.current) {
      return;
    }
    setLoadingMore(next);
  });

  const setFirstFetchDoneState = useMemoizedFn((next: boolean) => {
    firstFetchDoneRef.current = next;
    if (!mountedRef.current) {
      return;
    }
    setFirstFetchDone(next);
  });

  const resetHistoryData = useMemoizedFn(() => {
    cursorRef.current = 0;
    hasMoreRef.current = true;
    setLoadingMoreState(false);
    if (!mountedRef.current) {
      return;
    }
    setHistoryData({
      list: [],
      hasMore: true,
    });
    setFirstFetchDoneState(false);
  });

  const fetchHistoryPage = useMemoizedFn(
    async (startTime = 0): Promise<TokenHistoryPage> => {
      const emptyPage = {
        list: [],
        hasMore: false,
        last: 0,
      };

      if (disableHistoryRequest) {
        return emptyPage;
      }

      const account = finalAccount;
      if (!account) {
        return emptyPage;
      }
      const addr = account.address.toLowerCase();

      const result = await fetchData(
        addr,
        startTime,
        tokenItem.chain,
        tokenItem.id,
        isMyAddress,
      );
      const list = result.list.map(item => {
        return {
          ...item,
          account,
        };
      });

      return {
        list: orderBy(list, 'time_at', 'desc'),
        hasMore: result.list.length >= PAGE_COUNT && !!result.last,
        last: result.last || 0,
      };
    },
  );

  const applyHistoryPage = useMemoizedFn(
    (page: TokenHistoryPage, mode: 'replace' | 'append') => {
      if (!mountedRef.current) {
        return;
      }

      setHistoryData(prev => {
        if (mode === 'replace') {
          if (!page.list.length && prev.list.length) {
            hasMoreRef.current = prev.hasMore;
            return prev;
          }

          cursorRef.current = page.last;
          hasMoreRef.current = page.hasMore;
          return {
            list: page.list,
            hasMore: page.hasMore,
          };
        }

        if (!page.list.length) {
          hasMoreRef.current = false;
          return {
            list: prev.list,
            hasMore: false,
          };
        }

        const existingKeys = new Set(prev.list.map(item => item.key));
        const nextList = orderBy(
          [
            ...prev.list,
            ...page.list.filter(item => !existingKeys.has(item.key)),
          ],
          'time_at',
          'desc',
        );

        cursorRef.current = page.last;
        hasMoreRef.current = page.hasMore;
        return {
          list: nextList,
          hasMore: page.hasMore,
        };
      });
    },
  );

  const reloadHistory = useMemoizedFn(async (clearList = false) => {
    const requestId = ++requestSeqRef.current;

    if (clearList) {
      resetHistoryData();
    } else {
      setFirstFetchDoneState(false);
    }
    setLoadingMoreState(false);
    setLoadingState(true);

    try {
      const page = await fetchHistoryPage(0);
      if (requestSeqRef.current !== requestId) {
        return;
      }
      applyHistoryPage(page, 'replace');
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoadingState(false);
        setFirstFetchDoneState(true);
      }
    }
  });

  const loadMoreHistory = useMemoizedFn(async () => {
    if (disableHistoryRequest) {
      return;
    }
    if (
      loadingRef.current ||
      loadingMoreRef.current ||
      !firstFetchDoneRef.current ||
      !hasMoreRef.current
    ) {
      return;
    }

    const requestId = ++requestSeqRef.current;
    setLoadingMoreState(true);

    try {
      const page = await fetchHistoryPage(cursorRef.current);
      if (requestSeqRef.current !== requestId) {
        return;
      }
      applyHistoryPage(page, 'append');
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoadingMoreState(false);
      }
    }
  });

  const refresh = useMemoizedFn(() => {
    reloadHistory(false);
    onRefresh?.();
  });

  useEffect(() => {
    const shouldScrollToTop = isReady.current;
    reloadHistory(true);
    if (shouldScrollToTop) {
      historyListRef.current?.scrollToTop();
    } else {
      isReady.current = true;
    }
  }, [
    disableHistoryRequest,
    isSceneUsingAllAccounts,
    reloadHistory,
    requestKey,
    sceneCurrentAccountDepKey,
  ]);

  const batchFetchDataFromDbUpsert = useMemoizedFn(async () => {
    reloadHistory(false);
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

  useAppOrmSyncEvents({
    taskFor: ['all-history'],
    onRemoteDataUpserted: ctx => {
      if (!ctx.success || !isMyAddress || !currentAddress) {
        return;
      }
      if (ctx.owner_addr.toLowerCase() !== currentAddress.toLowerCase()) {
        return;
      }
      throttleBatchFetchData();
    },
  });

  useMount(() => {
    const list = transactionHistoryService.getSucceedList();
    setHistorySuccessList(list);
    transactionHistoryService.clearSuccessAndFailList(currentAddress);
  });

  const displayList = useMemo(() => {
    return (
      historyData.list.filter(tx => {
        const shouldShowBasedOnType = !tx.is_scam;
        return shouldShowBasedOnType;
      }) || []
    );
  }, [historyData.list]);

  const noMore =
    disableHistoryRequest || (firstFetchDone && !historyData.hasMore);

  useEffect(() => {
    if (!isMyAddress || !firstFetchDone || displayList.length || loading) {
      return;
    }
    if (!currentAddress) {
      return;
    }
    syncSingleAddress(currentAddress.toLowerCase());
  }, [
    currentAddress,
    displayList.length,
    firstFetchDone,
    isMyAddress,
    loading,
  ]);

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
        // avoid exec multi times loadMore
        if (loading || loadingMore || noMore || !firstFetchDone) {
          return;
        }
        loadMoreHistory();
      }}
      onRefresh={refresh}
    />
  );
};

const getStyle = createGetStyles2024(ctx => ({
  overwriteListContainer: {
    paddingHorizontal: 12,
  },
  container: {
    width: '100%',
    // paddingHorizontal: 15,
    marginTop: 0,
    gap: 0,
  },
  bottomBg: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 4,
  },
  defiItem: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // paddingVertical: 6,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    padding: 16,
  },
  defiItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginBottom: 16,
    // paddingHorizontal: 20,
    gap: 6,
  },
  popupRelateTitle: {
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  relateTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    paddingLeft: 5,
    fontWeight: '900',
  },
  rightContent: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 4,
    paddingRight: 1,
  },
  historyHeader: {
    paddingHorizontal: 15,
    marginBottom: -8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  defiItemText: {
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginLeft: 6,
  },
  arrowStyle: {
    marginTop: 0,
  },

  body: {},
  balanceTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },

  itemCard: {
    marginTop: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    borderColor: ctx.colors2024['neutral-line'],
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  tokenBox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  tokenUsd: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
  },
  tokenAmount: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  emptyStyle: {
    height: 150,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    flexDirection: 'column',
    gap: 12,
  },
}));
