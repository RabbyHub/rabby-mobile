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
import { useInfiniteScroll, useMemoizedFn, useMount } from 'ahooks';
import { KeyringAccountWithAlias } from '@/hooks/account';
import {
  ensureHistoryListItemFromDb,
  fetchHistoryTokenItem,
  getHistoryItemType,
} from '@/screens/Transaction/components/utils';
import { useTranslation } from 'react-i18next';
import { HistoryList } from '@/screens/Transaction/components/HistoryGroupList';
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
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { ITokenItem } from '@/store/tokens';

interface IFetchHistory {
  last: number;
  list: HistoryDisplayItem[];
}

const PAGE_COUNT = 20;

export const TokenDetailHistoryList = ({
  finalAccount,
  token,
  onRefresh,
  onReachTopStatusChange,
}: {
  finalAccount: KeyringAccountWithAlias | null;
  token: ITokenItem;
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
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
  const lastMap = useRef<Record<string, number>>({});
  const dbLastCursorRef = useRef<number>(0);
  const hasMoreMap = useRef<Record<string, boolean>>({});

  const [historySuccessList, setHistorySuccessList] = useState<string[]>(
    transactionHistoryService.getSucceedList(),
  );

  const historyListRef = useRef<{ scrollToTop: () => void }>(null);
  const scrollY = useCurrentTabScrollY();
  const handleScroll = useCallback(
    (currentScrollY: number) => {
      if (currentScrollY <= 0) {
        onReachTopStatusChange?.(true);
      } else {
        onReachTopStatusChange?.(false);
      }
    },
    [onReachTopStatusChange],
  );

  useAnimatedReaction(
    () => scrollY.value,
    currentScrollY => {
      runOnJS(handleScroll)(currentScrollY);
    },
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
    return (
      finalAccount?.type !== KEYRING_CLASS.WATCH &&
      finalAccount?.type !== KEYRING_CLASS.GNOSIS
    );
  }, [finalAccount]);

  const batchFetchData = useMemoizedFn(async () => {
    const list: HistoryDisplayItem[] = [];
    const account = finalAccount;
    if (!account) {
      return {
        list: [],
        hasMore: false,
      };
    }
    const addr = account.address.toLowerCase();
    if (addr in hasMoreMap.current && !hasMoreMap.current[addr]) {
      return {
        list: [],
        hasMore: false,
      };
    }

    const result = await fetchData(
      addr,
      lastMap.current[addr] || 0,
      tokenItem.chain,
      tokenItem.id,
      isMyAddress,
    );
    if (result.list.length < PAGE_COUNT) {
      hasMoreMap.current[addr] = false;
    } else {
      hasMoreMap.current[addr] = true;
    }
    lastMap.current[addr] = result.last || 0;
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
    reloadAsync,
    cancel,
  } = useInfiniteScroll(() => batchFetchData(), {
    isNoMore: d => (d ? !d.hasMore : false),
    onSuccess() {},
  });

  const refresh = useMemoizedFn(() => {
    lastMap.current = {};
    hasMoreMap.current = {};
    reloadAsync();
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
    dbLastCursorRef.current = 0;
    reloadAsync();
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

  useMount(() => {
    const list = transactionHistoryService.getSucceedList();
    setHistorySuccessList(list);
    transactionHistoryService.clearSuccessAndFailList(currentAddress);
  });

  const displayList = useMemo(() => {
    return (
      fetchApiData?.list.filter(tx => {
        const shouldShowBasedOnType = !tx.is_scam;
        return shouldShowBasedOnType;
      }) || []
    );
  }, [fetchApiData]);

  return (
    <>
      {!loading && !displayList.length && noMore && (
        <Empty
          style={styles.emptyStyle}
          title={t('page.activities.signedTx.empty.title')}
        />
      )}
      <HistoryList
        ref={historyListRef}
        historySuccessList={historySuccessList}
        list={displayList}
        loading={false}
        isNeedFetchFromApi={!isMyAddress}
        tabList
        firstFetchDone={false}
        loadingMore={loadingMore}
        refreshLoading={loading}
        isForMultipleAddress={false}
        appendBottom={300}
        moreLoadingLength={5}
        loadMore={() => {
          // avoid exec multi times loadMore
          if (loadingMore || noMore) {
            return;
          }
          loadMore();
        }}
        onRefresh={refresh}
      />
    </>
  );
};

const getStyle = createGetStyles2024(ctx => ({
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
    marginTop: 100,
    height: 150,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    flexDirection: 'column',
    gap: 12,
  },
}));
