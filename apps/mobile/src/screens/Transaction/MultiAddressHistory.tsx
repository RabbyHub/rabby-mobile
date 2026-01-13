import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { makeTxPageBackgroundColors, RootNames } from '@/constant/layout';
import {
  HistoryItemEntity,
  ProjectItemType,
} from '@/databases/entities/historyItem';
import { openapi } from '@/core/request';
import { preferenceService, transactionHistoryService } from '@/core/services';
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
import { last, unionBy, orderBy, debounce } from 'lodash';
import { Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import {
  TokenItem,
  TxAllHistoryResult,
  TxHistoryItem,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { HistoryList } from './components/HistoryGroupList';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { BottomSheetModalTokenDetail } from '@/components/TokenDetailPopup/BottomSheetModalTokenDetail';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { toast } from '@/components2024/Toast';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { AssetAvatar } from '@/components';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import { syncTop10History, syncSingleAddress } from '@/databases/hooks/history';
import { HistoryFilterMenu } from './components/HistoryFilterMenu';
import { useHistoryLoading } from '@/hooks/historyTokenDict';
import { TransactionAlert } from '../TransactionRecord/components/TransactionAlert';
import {
  ensureHistoryListItemFromDb,
  fetchHistoryTokenItem,
  getHistoryItemType,
} from './components/utils';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useTranslation } from 'react-i18next';
import { useAccountInfo } from '../Address/components/MultiAssets/hooks';
import {
  CUSTOM_HISTORY_TITLE_TYPE,
  HistoryItemCateType,
} from './components/type';

const _PAGE_COUNT = 200;
const REALL_TIME_API_PAGE_COUNT = 20;

export interface HistoryDisplayItem extends TxHistoryItem {
  // projectDict: TxHistoryResult['project_dict'];
  // cateDict: TxHistoryResult['cate_dict'];
  // tokenDict: TxHistoryResult['token_dict'];
  receives: {
    amount: number;
    from_addr: string;
    token_id: string;
    price?: number;
    token: TokenItem;
  }[];
  sends: {
    amount: number;
    to_addr: string;
    token_id: string;
    price?: number;
    token: TokenItem;
  }[];
  time_at: number;
  token_approve: {
    spender: string;
    token_id: string;
    value: number;
    price?: number;
    token?: TokenItem;
  } | null;
  address: string;
  project_item: ProjectItemType;
  key: string;
  isSmallUsdTx?: boolean; // is will be filtered small tx
  account?: KeyringAccountWithAlias;
  isShowSuccess?: boolean;
  historyType: HistoryItemCateType;
  historyCustomType?: CUSTOM_HISTORY_TITLE_TYPE;
}

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

function History({
  isTestnet = false,
  isForMultipleAddress,
}: {
  isTestnet?: boolean;
  isForMultipleAddress: boolean;
}): JSX.Element {
  const { myTop10Addresses, list: accountList } = useAccountInfo();
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'MultiAddressHistory'
      >
    >();
  const { tokenItem, isInTokenDetail, currentAddress } = route.params || {};
  const { t } = useTranslation();
  const isReady = useRef(false);
  const lastMap = useRef<Record<string, number>>({});
  const dbLastCursorRef = useRef<number>(0);
  const dbFetchLoadingRef = useRef<boolean>(false);
  const hasMoreMap = useRef<Record<string, boolean>>({});
  const [isShowAll, setIsShowAll] = useState(false);
  const { styles } = useTheme2024({ getStyle });
  const [dbData, setDbData] = useState<HistoryDisplayItem[]>([]);
  const PAGE_COUNT = isInTokenDetail ? REALL_TIME_API_PAGE_COUNT : _PAGE_COUNT;
  const {
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
    sceneCurrentAccountDepKey,
  } = useSceneAccountInfo({
    forScene: isForMultipleAddress ? 'MultiHistory' : 'History',
  });
  const [firstFetchDone, setFirstFetchDone] = useState(false);
  const [historySuccessList, setHistorySuccessList] = useState<string[]>(
    transactionHistoryService.getSucceedList(),
  );

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

  const historyLoading = useHistoryLoading();

  const historyListRef = useRef<{ scrollToTop: () => void }>(null);

  const batchFetchDataFromDb = useMemoizedFn(
    async (filterScamAndSmallTx?: boolean) => {
      // fetch data from local database

      // judge if is need
      if (dbFetchLoadingRef.current) {
        console.warn('loading multi time , pls check what happened');
        return {
          list: [],
          hasMore: true,
        };
      }
      const isFilter =
        filterScamAndSmallTx === undefined ? !isShowAll : filterScamAndSmallTx;
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
        filterScamAndSmallTx: isFilter,
      });

      const oneHourAgo = Math.floor(new Date().getTime() / 1000) - 60 * 60;
      const list = historyList.map(item => {
        return {
          ...ensureHistoryListItemFromDb(item),
          // hidden small and scam no need this prop
          isSmallUsdTx: isFilter
            ? false
            : item.is_small_tx && item.time_at <= oneHourAgo,
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
    },
  );
  const isNeedFetchFromApi = useMemo(() => {
    const isUseingContactsOrSafe =
      !isSceneUsingAllAccounts &&
      (finalSceneCurrentAccount?.type === KEYRING_CLASS.WATCH ||
        finalSceneCurrentAccount?.type === KEYRING_CLASS.GNOSIS);
    return isInTokenDetail || isUseingContactsOrSafe;
  }, [isSceneUsingAllAccounts, finalSceneCurrentAccount, isInTokenDetail]);

  const batchFetchData = useMemoizedFn(async () => {
    const list: HistoryDisplayItem[] = [];

    if (!isNeedFetchFromApi) {
      const res = await batchFetchDataFromDb();
      if (!isReady.current) {
        isReady.current = true;
      }
      return res;
    } else {
      const accountListArr = isSceneUsingAllAccounts
        ? accountList.slice(0, 10)
        : [finalSceneCurrentAccount];

      const queue = new PQueue({
        interval: 2000,
        intervalCap: 10,
      });
      for (let i = 0; i < accountListArr.length; i++) {
        queue.add(async () => {
          const account = accountListArr[i];
          if (!account) {
            return;
          }
          const addr = account.address.toLowerCase();
          if (addr in hasMoreMap.current && !hasMoreMap.current[addr]) {
            return;
          }
          const needFilter = isInTokenDetail && tokenItem;
          const result = needFilter
            ? await fetchData(
                addr,
                lastMap.current[addr] || 0,
                tokenItem.chain,
                tokenItem._tokenId,
              )
            : await fetchData(addr, lastMap.current[addr] || 0);
          if (result.list.length < PAGE_COUNT) {
            hasMoreMap.current[addr] = false;
          } else {
            hasMoreMap.current[addr] = true;
          }
          lastMap.current[addr] = result.last || 0;
          // const pinedQueue = preferenceService.getPinToken();

          list.push(
            ...result.list.map(item => {
              return {
                ...item,
                account,
              };
            }),
          );
        });
      }
      if (!isReady.current) {
        isReady.current = true;
      }
      if (accountList.length > 0) {
        await waitQueueFinished(queue);
      }
      return {
        list: orderBy(list, 'time_at', 'desc'),
        hasMore: Object.values(hasMoreMap.current).some(item => item),
      };
    }
  });

  const fetchData = async (
    address: string,
    startTime = 0,
    chain_id?: string,
    token_id?: string,
  ): Promise<IFetchHistory> => {
    if (isTestnet) {
      return {
        last: 0,
        list: [],
      };
    }
    if (!address) {
      throw new Error('no account');
    }

    const getHistory = !isInTokenDetail
      ? openapi.getAllTxHistory
      : openapi.listTxHisotry;
    try {
      const res = await getHistory({
        id: address,
        start_time: startTime,
        page_count: PAGE_COUNT,
        chain_id,
        token_id,
      });

      const { project_dict, history_list: list } = res;
      const token_dict = (res as TxHistoryResult).token_dict;
      const token_uuid_dict = (res as TxAllHistoryResult).token_uuid_dict;
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
    } catch (e) {
      toast.error(`${address} fetch failed, ${e}`);
      return {
        last: 0,
        list: [],
      };
    }
  };

  const batchFetchLocalTx = async () => {
    if (isInTokenDetail) {
      return [];
    }

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
              !item.isSubmitFailed && // not submit failed
              !isSynced // not has synced and not in history list
            );
          })),
    ];
  });

  const { data: groups, runAsync: runFetchLocalTx } = useRequest(async () => {
    return batchFetchLocalTx();
  });

  useInterval(() => runFetchLocalTx(), groups?.length ? 5000 : 60 * 1000);

  const refresh = useMemoizedFn(() => {
    lastMap.current = {};
    hasMoreMap.current = {};
    runFetchLocalTx();
    if (isNeedFetchFromApi) {
      reloadAsync();
    } else {
      dbLastCursorRef.current = 0;
      isSceneUsingAllAccounts
        ? syncTop10History(myTop10Addresses, true)
        : syncSingleAddress(finalSceneCurrentAccount?.address.toLowerCase()!);
    }
  });

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
    // isNoMore: ({ hasMore }) => {
    //   if (loadingMore) {
    //     console.log('11111111111111111111111111');
    //     return true;
    //   }
    //   if (!isNeedFetchFromApi) {
    //     // load from db
    //     return hasMore;
    //   }
    //   console.log('?????????????');
    //   return Object.values(hasMoreMap.current).every(item => !item);
    // },
    onSuccess() {
      runFetchLocalTx();
    },
  });

  useEffect(() => {
    if (isReady.current) {
      if (!isNeedFetchFromApi) {
        setFirstFetchDone(false);
        dbLastCursorRef.current = 0;
        reloadAsync();
        runFetchLocalTx();
      } else {
        cancel();
        refresh();
      }
      historyListRef.current?.scrollToTop();
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

  useAppOrmSyncEvents({
    taskFor: ['all-history'],
    onRemoteDataUpserted: ctx => {
      switch (ctx.taskFor) {
        case 'all-history':
          throttleBatchFetchData();
          break;
        default:
          break;
      }
    },
  });

  const rawDataList = useMemo(() => {
    return isNeedFetchFromApi ? fetchApiData : { list: dbData };
  }, [fetchApiData, isNeedFetchFromApi, dbData]);

  // const allTxHistory = useMemo(() => {
  //   // make receive front of send by cate_id order by asc
  //   return orderBy(data?.list || [], ['time_at', 'cate_id'], ['desc', 'asc']);
  // }, [data]);

  useMount(() => {
    const list = transactionHistoryService.getSucceedList();
    setHistorySuccessList(list);
    transactionHistoryService.clearSuccessAndFailList(
      isForMultipleAddress ? undefined : currentAddress,
    );
  });

  const displayList = useMemo(() => {
    const dataList = isNeedFetchFromApi ? fetchApiData : { list: dbData };

    return (
      dataList?.list.filter(tx => {
        // based on tx type
        const shouldShowBasedOnType =
          isShowAll || !isNeedFetchFromApi || !tx.is_scam;

        // based on account
        const shouldShowBasedOnAccount =
          isSceneUsingAllAccounts ||
          isSameAddress(finalSceneCurrentAccount?.address || '', tx.address);

        // both conditions need to be met
        return shouldShowBasedOnType && shouldShowBasedOnAccount;
      }) || []
    );
  }, [
    fetchApiData,
    dbData,
    isNeedFetchFromApi,
    isShowAll,
    // currentPage,
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
  ]);

  useEffect(() => {
    eventBus.addListener(EVENTS.RELOAD_TX, runFetchLocalTx);
    return () => {
      eventBus.removeListener(EVENTS.RELOAD_TX, runFetchLocalTx);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getHeaderRight = useCallback(() => {
    return (
      <HistoryFilterMenu
        isShowAll={isShowAll}
        setIsShowAll={setIsShowAll}
        handleSwitchShowAll={value => {
          historyListRef.current?.scrollToTop();
          dbLastCursorRef.current = 0;
          batchFetchDataFromDb(value);
        }}
      />
    );
  }, [isShowAll, setIsShowAll, batchFetchDataFromDb]);

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const getHeaderTitle = useCallback(() => {
    return (
      <ScreenHeaderAccountSwitcher
        forScene={isForMultipleAddress ? 'MultiHistory' : 'History'}
        titleText={
          <View style={styles.headerTitle}>
            <AssetAvatar
              logo={tokenItem?.logo_url}
              size={24}
              chain={tokenItem?.chain}
              chainSize={10}
            />
            <Text style={styles.titleText}>{tokenItem?.symbol}</Text>
            <Text style={styles.titleText}>Transactions</Text>
          </View>
        }
        disableSwitch={!isForMultipleAddress}
      />
    );
  }, [tokenItem, isForMultipleAddress, styles.titleText, styles.headerTitle]);

  React.useEffect(() => {
    if (isInTokenDetail && tokenItem) {
      setNavigationOptions({
        headerTitle: getHeaderTitle,
        headerRight: getHeaderRight,
      });
    } else {
      setNavigationOptions({
        headerRight: getHeaderRight,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNavigationOptions, getHeaderTitle, getHeaderRight]);

  const ensureCurrentIsLoading = useMemo(() => {
    if (isNeedFetchFromApi) {
      return false;
    }

    const addresses = isSceneUsingAllAccounts
      ? myTop10Addresses.map(a => a.toLowerCase())
      : [finalSceneCurrentAccount?.address.toLowerCase()!];
    const isLoading = addresses.some(address => {
      return historyLoading[address];
    });
    return isLoading;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading, sceneCurrentAccountDepKey]);

  const fetchFromDbLoading = useMemo(
    () =>
      Boolean(
        firstFetchDone &&
          !rawDataList?.list.length &&
          !groups?.length &&
          ensureCurrentIsLoading,
      ),
    [
      firstFetchDone,
      rawDataList?.list.length,
      groups?.length,
      ensureCurrentIsLoading,
    ],
  );

  const combinedList = useMemo(() => {
    // create a key Set for the recent transactions, for quick lookup
    const recentTxKeys = new Set(
      displayList
        .slice(0, 10)
        .map(item => `${item.address.toLowerCase()}-${item.id}`),
    );

    // filter out groups that are the same as the recent transactions
    const uniqueGroups =
      groups?.filter(
        group =>
          !recentTxKeys.has(
            `${group.address.toLowerCase()}-${group.maxGasTx.hash}`,
          ),
      ) || [];
    return [...(uniqueGroups || []), ...(displayList || [])];
  }, [groups, displayList]);

  return (
    // eslint-disable-next-line react-native/no-inline-styles
    <View style={{ paddingTop: 0, position: 'relative' }}>
      <>
        <TransactionAlert pendingTxs={groups?.filter(item => item.isPending)} />
        <HistoryList
          ref={historyListRef}
          historySuccessList={historySuccessList}
          list={combinedList}
          localTxList={groups}
          loading={isNeedFetchFromApi ? loading : fetchFromDbLoading}
          isNeedFetchFromApi={isNeedFetchFromApi}
          firstFetchDone={firstFetchDone}
          loadingMore={loadingMore}
          refreshLoading={isNeedFetchFromApi && loading}
          isForMultipleAddress={isForMultipleAddress}
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
    </View>
  );
}

const HistoryScreen = ({ isForMultipleAddress = true }) => {
  const {
    sheetModalRef: tokenDetailModalRef,
    cleanFocusingToken,
    focusingToken,
    tokenDetailAddress,
    setTokenDetailAddress,
  } = useGeneralTokenDetailSheetModal();

  const { styles } = useTheme2024({ getStyle });

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      {isForMultipleAddress && (
        <AccountSwitcherModal
          forScene="MultiHistory"
          inScreen
          // panelLinearGradientProps={{ type: 'tx-page' }}
        />
      )}
      <ScreenSpecificStatusBar screenName={RootNames.History} />
      <History isTestnet={false} isForMultipleAddress={isForMultipleAddress} />
      {/* TODO: it seems to be useless, drop it after confirming */}
      <BottomSheetModalTokenDetail
        __shouldSwitchSceneAccountBeforeRedirect__
        ref={tokenDetailModalRef}
        token={focusingToken}
        onDismiss={() => {
          cleanFocusingToken({ noNeedCloseModal: true });
          setTokenDetailAddress(undefined);
        }}
        onTriggerDismissFromInternal={() => {
          // toggleShowSheetModal('tokenDetailModalRef', false);
          cleanFocusingToken();
          setTokenDetailAddress(undefined);
        }}
        address={tokenDetailAddress}
        nextTxRedirectAccount={tokenDetailAddress}
      />
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    backgroundColor: makeTxPageBackgroundColors({ isLight, colors2024 }),
  },
  menuContainer: {
    elevation: 5,
    shadowColor: 'rgba(25, 35, 60, 0.2)', // Shadow color
    shadowOffset: { width: 0, height: 12 }, // Horizontal and vertical offsets
    shadowOpacity: 0.2, // Shadow opacity
    shadowRadius: 8, // Blur radius
    // flexDirection: 'row',
    zIndex: 1,
    // justifyContent: 'space-between',
    position: 'absolute',
    top: 0,
    right: 16,
    alignItems: 'center',
    width: 270,
    // height: 56,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 12,
    paddingVertical: 16,
    // paddingVertical: 16,
    borderRadius: 16,
    gap: 16,
  },
  menuItem: {
    // height: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    // alignItems: 'center',
  },
  menuItemText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  valueView: {
    // width: '50%',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  link: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: colors2024['brand-light-1'],
    borderWidth: 1,
  },
  linkText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['brand-default'],
  },
  headerTitle: {
    flexWrap: 'nowrap',
    // justifyContent: 'center',
    // alignItems: 'center',
    flexDirection: 'row',
  },
  titleText: {
    marginLeft: 4,
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  netTabs: {
    marginBottom: 12,
  },
  notFound: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80%',
  },
  notFoundText: {
    fontSize: 14,
    lineHeight: 17,
    color: colors2024['neutral-body'],
    marginTop: 16,
  },
}));

const ForSingleAddress = () => {
  // const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
  //   forScene: 'MakeTransactionAbout',
  // });

  return <HistoryScreen isForMultipleAddress={false} />;
};
HistoryScreen.ForSingleAddress = ForSingleAddress;

export default HistoryScreen;
