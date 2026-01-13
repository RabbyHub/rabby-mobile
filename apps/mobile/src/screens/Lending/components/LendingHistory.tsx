/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { openapi } from '@/core/request';
import { transactionHistoryService } from '@/core/services';
import { findChain, findChainByServerID } from '@/utils/chain';
import { EVENTS, eventBus } from '@/utils/events';
import {
  useInfiniteScroll,
  useInterval,
  useMemoizedFn,
  useMount,
  useRequest,
} from 'ahooks';
import PQueue from 'p-queue';
import { last, orderBy, debounce } from 'lodash';
import { Text, View } from 'react-native';
import { HistoryList } from '@/screens/Transaction/components/HistoryGroupList';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { syncSingleAddress } from '@/databases/hooks/history';
import {
  ensureHistoryListItemFromDb,
  fetchHistoryTokenItem,
  getHistoryItemType,
} from '@/screens/Transaction/components/utils';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { makeTxPageBackgroundColors } from '@/constant/layout';

const _PAGE_COUNT = 200;

interface IFetchHistory {
  last: number;
  list: HistoryDisplayItem[];
}

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('empty', () => {
      if (q.pending <= 0) {
        resolve(null);
      }
    });
  });
};

function LendingHistory(): JSX.Element {
  const { myTop10Addresses } = useAccountInfo();
  const { styles } = useTheme2024({ getStyle: getStyles });

  // Lending history only shows all accounts, no watch/safe addresses, no token details
  const isForMultipleAddress = true;
  const isTestnet = false;

  const isReady = useRef(false);
  const lastMap = useRef<Record<string, number>>({});
  const dbLastCursorRef = useRef<number>(0);
  const dbFetchLoadingRef = useRef<boolean>(false);
  const hasMoreMap = useRef<Record<string, boolean>>({});
  const [isShowAll, setIsShowAll] = useState(false);
  const [dbData, setDbData] = useState<HistoryDisplayItem[]>([]);

  const { finalSceneCurrentAccount, sceneCurrentAccountDepKey } =
    useSceneAccountInfo({
      forScene: 'Lending',
    });
  const isSceneUsingAllAccounts = false;
  const [firstFetchDone, setFirstFetchDone] = useState(false);
  const [historySuccessList, setHistorySuccessList] = useState<string[]>([]);

  const mergeDataWithDeduplication = useMemoizedFn(
    (
      existingData: HistoryDisplayItem[],
      newData: HistoryDisplayItem[],
      insertType: 'front' | 'back',
    ) => {
      const existingKeys = new Set(existingData.map(item => item.key));
      const uniqueNewData = newData.filter(item => !existingKeys.has(item.key));
      return insertType === 'front'
        ? [...uniqueNewData, ...existingData]
        : [...existingData, ...uniqueNewData];
    },
  );

  const historyListRef = useRef<{ scrollToTop: () => void }>(null);

  const batchFetchDataFromDb = useMemoizedFn(async () => {
    // fetch data from local database

    // judge if is need
    if (dbFetchLoadingRef.current) {
      console.warn('loading multi time , pls check what happened');
      return {
        list: [],
        hasMore: true,
      };
    }
    dbFetchLoadingRef.current = true;
    const addresses = isSceneUsingAllAccounts
      ? myTop10Addresses.map(i => i.toLowerCase())
      : [finalSceneCurrentAccount?.address.toLowerCase() || ''];
    const {
      items: historyList,
      hasMore,
      nextCursor,
    } = await HistoryItemEntity.getHistoryItemsPaginated(addresses, {
      pageSize: 20,
      lastTimeAt: dbLastCursorRef.current,
      filterScamAndSmallTx: false,
      filterLendingHistory: true,
    });

    const list = historyList.map(item => {
      return {
        ...ensureHistoryListItemFromDb(item),
        // hidden small and scam no need this prop
        isSmallUsdTx: false,
        isShowSuccess: historySuccessList.includes(
          `${item.owner_addr.toLowerCase()}-${item.txHash}`,
        ),
      } as HistoryDisplayItem;
    });

    if (dbLastCursorRef.current === 0) {
      setDbData(list);
    } else {
      setDbData(prev => mergeDataWithDeduplication(prev, list, 'back'));
    }
    dbLastCursorRef.current = nextCursor || 0;
    dbFetchLoadingRef.current = false;
    setFirstFetchDone(true);
    return { list, hasMore };
  });

  const batchFetchData = useMemoizedFn(async () => {
    const res = await batchFetchDataFromDb();
    if (!isReady.current) {
      isReady.current = true;
    }
    return res;
  });

  const batchFetchLocalTx = async () => {
    const list: TransactionGroup[] = [];
    const addressList = isSceneUsingAllAccounts
      ? myTop10Addresses
      : [finalSceneCurrentAccount?.address.toLowerCase()];
    for (let i = 0; i < addressList.length; i++) {
      const addr = addressList[i];
      if (!addr) {
        continue;
      }
      const localTxs = await fetchLocalTx(addr);
      list.push(...localTxs);
    }

    if (finalSceneCurrentAccount?.address) {
      const lendingSuccessHistoryList =
        transactionHistoryService.getLendingSuccessHistoryList(
          finalSceneCurrentAccount?.address.toLowerCase()!,
        );
      // Merge and deduplicate using Set
      setHistorySuccessList(items => {
        const uniqueList = Array.from(
          new Set([...items, ...lendingSuccessHistoryList]),
        );
        return uniqueList;
      });
      transactionHistoryService.clearLendingSuccessHistoryList(
        finalSceneCurrentAccount?.address.toLowerCase()!,
      );
    }

    return list;
  };

  const fetchLocalTx = useMemoizedFn(async (address: string) => {
    const { pendings: _pendings, completeds: _completeds } =
      transactionHistoryService.getList(address);

    const pendings = _pendings.filter(item => {
      const chain = findChain({ id: item.chainId });
      return isTestnet ? chain?.isTestnet : !chain?.isTestnet;
    });

    const completeds = _completeds.filter(item => {
      const chain = findChain({ id: item.chainId });
      return isTestnet ? chain?.isTestnet : !chain?.isTestnet;
    });

    return [
      ...pendings,
      ...(isTestnet
        ? completeds
        : completeds.filter(item => {
            const isSynced =
              !!rawDataList?.list.find(tx => {
                return (
                  tx.id === item.maxGasTx.hash &&
                  findChainByServerID(tx.chain)?.id === item.chainId
                );
              }) || item.isSynced;

            if (isSynced && !item.isSynced) {
              transactionHistoryService.updateTx({
                ...item.maxGasTx,
                isSynced: true,
              });
            }

            return (
              item.createdAt >= Date.now() - 3600000 && // gap smaller 1 hour
              !item.isSubmitFailed &&
              !isSynced // not has synced and not in history list
            );
          })),
    ];
  });

  const { data: groups, runAsync: runFetchLocalTx } = useRequest(async () => {
    return batchFetchLocalTx();
  });

  useInterval(() => runFetchLocalTx(), groups?.length ? 5000 : 60 * 1000);

  useEffect(() => {
    if (dbData.length === 0 && !isSceneUsingAllAccounts && firstFetchDone) {
      syncSingleAddress(finalSceneCurrentAccount?.address.toLowerCase()!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dbData.length,
    isSceneUsingAllAccounts,
    firstFetchDone,
    finalSceneCurrentAccount?.address,
  ]);
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
    onSuccess() {
      runFetchLocalTx();
    },
  });

  useEffect(() => {
    if (isReady.current) {
      setFirstFetchDone(false);
      dbLastCursorRef.current = 0;
      reloadAsync();
      runFetchLocalTx();
      historyListRef.current?.scrollToTop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneCurrentAccountDepKey, isSceneUsingAllAccounts]);

  const rawDataList = useMemo(() => {
    return { list: dbData };
  }, [dbData]);

  // const allTxHistory = useMemo(() => {
  //   // make receive front of send by cate_id order by asc
  //   return orderBy(data?.list || [], ['time_at', 'cate_id'], ['desc', 'asc']);
  // }, [data]);

  const displayList = useMemo(() => {
    return dbData;
  }, [dbData]);

  useEffect(() => {
    eventBus.addListener(EVENTS.RELOAD_TX, runFetchLocalTx);
    return () => {
      eventBus.removeListener(EVENTS.RELOAD_TX, runFetchLocalTx);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFromDbLoading = false;

  const combinedList = useMemo(() => {
    // create a key Set for the recent transactions, for quick lookup
    const recentTxKeys = new Set(
      displayList
        .slice(0, 10)
        .map(item => `${item.address.toLowerCase()}-${item.id}`),
    );

    // filter out groups that are the same as the recent transactions
    // also filter only lending transaction groups
    const uniqueGroups =
      groups?.filter(group => {
        // Check if this is a lending transaction
        const isLendingTx =
          group.customActionInfo?.customAction ===
          CUSTOM_HISTORY_ACTION.LENDING;

        if (!isLendingTx) {
          return false;
        }

        return !recentTxKeys.has(
          `${group.address.toLowerCase()}-${group.maxGasTx.hash}`,
        );
      }) || [];
    return [...(uniqueGroups || []), ...(displayList || [])];
  }, [groups, displayList]);

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      <View style={{ paddingTop: 0, position: 'relative' }}>
        <>
          <HistoryList
            ref={historyListRef}
            historySuccessList={historySuccessList}
            list={combinedList}
            localTxList={groups}
            loading={fetchFromDbLoading}
            firstFetchDone={firstFetchDone}
            loadingMore={loadingMore}
            refreshLoading={fetchFromDbLoading && loading}
            isForMultipleAddress={isForMultipleAddress}
            loadMore={loadMore}
            // onRefresh={refresh}
          />
        </>
      </View>
    </NormalScreenContainer2024>
  );
}

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  container: {
    backgroundColor: makeTxPageBackgroundColors({ isLight, colors2024 }),
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '600',
  },
}));

export default LendingHistory;
