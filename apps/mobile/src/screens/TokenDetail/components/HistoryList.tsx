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
import { useMemoizedFn } from 'ahooks';
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
import { debounce, last } from 'lodash';
import { toast } from '@/components2024/Toast';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { Empty } from '@/screens/Transaction/components/Empty';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/src/types';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import type { ITokenItem } from '@/store/tokens';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  useTransactionHistoryServiceReady,
  withTransactionHistoryService,
} from '@/core/serviceApi/transactionHistoryHooks';
import { useTokenHistoryResource } from './useTokenHistoryResource';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { useIsFocused } from '@react-navigation/native';

interface IFetchHistory {
  last: number;
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
  const isFocused = useIsFocused();

  const { isSceneUsingAllAccounts, sceneCurrentAccountDepKey } =
    useSceneAccountInfo({
      forScene: 'TokenDetail',
    });
  const tokenItem = token;
  const currentAddress = finalAccount?.address;

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
    count = PAGE_COUNT,
  ): Promise<IFetchHistory> => {
    if (!address) {
      throw new Error('no account');
    }

    if (isMyAddress) {
      const historyList =
        await HistoryItemEntity.getTokenHistoryItemSortedByTime(
          address,
          startTime,
          token_id,
          chain_id,
          count,
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
      const [res, transactions] = await Promise.all([
        openapi.listTxHisotry({
          id: address,
          start_time: startTime,
          page_count: count,
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
      !!finalAccount &&
      finalAccount.type !== KEYRING_CLASS.WATCH &&
      finalAccount?.type !== KEYRING_CLASS.GNOSIS
    );
  }, [finalAccount]);

  const requestKey = JSON.stringify([
    currentAddress?.toLowerCase(),
    finalAccount?.type,
    finalAccount?.brandName,
    tokenItem.chain,
    tokenItem.id,
    isMyAddress ? 'db' : 'api',
    sceneCurrentAccountDepKey,
    isSceneUsingAllAccounts,
  ]);
  const requestEnabled = !!currentAddress && !disableHistoryRequest;
  const fetchHistoryPage = async (
    cursor: number,
    count: number,
  ): Promise<IFetchHistory> => {
    const account = finalAccount;
    if (!account) return { list: [], last: 0 };
    const addr = account.address.toLowerCase();
    const result = await fetchData(
      addr,
      cursor,
      tokenItem.chain,
      tokenItem.id,
      isMyAddress,
      count,
    );
    return {
      last: result.last,
      list: result.list.map(item => ({ ...item, account })),
    };
  };

  const {
    list: historyRows,
    loading,
    loadingMore,
    loadMore,
    hasMore,
    firstFetchDone,
    error,
    refresh: reloadHistory,
    revalidate: revalidateHistory,
  } = useTokenHistoryResource({
    requestKey,
    enabled: requestEnabled,
    pageSize: PAGE_COUNT,
    fetchPage: fetchHistoryPage,
  });
  const noMore = !requestEnabled || (firstFetchDone && !hasMore);

  const refresh = useMemoizedFn(() => {
    void reloadHistory();
    onRefresh?.();
  });

  useEffect(() => {
    if (error) toast.error(`${currentAddress} fetch failed, ${error}`);
  }, [currentAddress, error]);

  const throttleBatchFetchData = useMemo(
    () =>
      debounce(
        () => {
          if (isFocused) void revalidateHistory();
        },
        1000,
        {
          leading: true,
          trailing: true,
        },
      ),
    [isFocused, revalidateHistory],
  );

  useEffect(() => {
    return () => {
      throttleBatchFetchData.cancel();
    };
  }, [throttleBatchFetchData]);

  useAppOrmSyncEvents({
    taskFor: 'all-history',
    onRemoteDataUpserted: ctx => {
      if (
        isFocused &&
        requestEnabled &&
        isMyAddress &&
        ctx.success &&
        ctx.owner_addr.toLowerCase() === currentAddress?.toLowerCase()
      ) {
        throttleBatchFetchData();
      }
    },
  });

  const wasFocusedRef = useRef(isFocused);
  useEffect(() => {
    if (isFocused && !wasFocusedRef.current) void revalidateHistory();
    wasFocusedRef.current = isFocused;
  }, [isFocused, revalidateHistory]);

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
      historyRows.filter(tx => {
        const shouldShowBasedOnType = !tx.is_scam;
        return shouldShowBasedOnType;
      }) || []
    );
  }, [historyRows]);

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
        void loadMore();
      }}
      onRefresh={refresh}
    />
  );
};

export const TokenDetailHistoryList = withTransactionHistoryService(
  TokenDetailHistoryListContent,
);

const getStyle = createGetStyles2024(ctx => ({
  overwriteListContainer: {
    paddingHorizontal: 12,
  },
  emptyStyle: {
    height: 150,
  },
}));
