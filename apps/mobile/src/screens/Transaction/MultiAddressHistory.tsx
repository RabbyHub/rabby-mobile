import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { makeTxPageBackgroundColors, RootNames } from '@/constant/layout';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { openapi } from '@/core/request';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { findChain, findChainByServerID, getChain } from '@/utils/chain';
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
  BuyHistoryItem,
  TxHistoryItem,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { HistoryList } from './components/HistoryGroupList';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
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
import { useSyncHistoryDB } from '@/databases/hooks/history';
import { HistoryFilterMenu } from './components/HistoryFilterMenu';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { SwapItemEntity } from '@/databases/entities/swapitem';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';
import { useSortAddressList } from '../Address/useSortAddressList';
import {
  ensureHistoryListItemFromDb,
  judgeIsSmallUsdTx,
} from './components/utils';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { GetNestedScreenNavigationProps } from '@/navigation-type';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useTranslation } from 'react-i18next';
import { BuyItemEntity } from '@/databases/entities/buyItem';
import { HistoryItemCateType } from './components/HistoryItemIcon';
import { LocalHistoryItemEntity } from '@/databases/entities/localhistoryItem';

const _PAGE_COUNT = 200;
const REALL_TIME_API_PAGE_COUNT = 20;

export interface HistoryDisplayItem extends TxHistoryItem {
  projectDict: TxHistoryResult['project_dict'];
  cateDict: TxHistoryResult['cate_dict'];
  tokenDict: TxHistoryResult['token_dict'];
  address: string;
  key: string;
  account?: KeyringAccountWithAlias;
  isLocalBuy?: boolean;
  buyDetails?: BuyItemEntity & BuyHistoryItem;
  isLocalSwap?: boolean;
  isShowSuccess?: boolean;
  isSmallUsdTx?: boolean;
  historyItemCateType?: HistoryItemCateType | '';
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
  isForMultipleAdderss,
}: {
  isTestnet?: boolean;
  isForMultipleAdderss: boolean;
}): JSX.Element {
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const route =
    useRoute<
      GetNestedScreenNavigationProps<
        'TransactionNavigatorParamList',
        'MultiAddressHistory'
      >['route']
    >();
  const { tokenItem, isInTokenDetail } = route.params || {};
  const unionAccounts = useMemo(() => {
    return unionBy(sortedAccounts, account => account.address.toLowerCase());
  }, [sortedAccounts]);
  const { t } = useTranslation();
  const isReady = useRef(false);
  const lastMap = useRef<Record<string, number>>({});
  const hasMoreMap = useRef<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [currentNoDbData, setCurrentNoDbData] = useState(false);
  const [isShowAll, setIsShowAll] = useState(false);
  // const [isShowSmall, setIsShowSmall] = useState(false);
  const [isShowMenu, setIsShowMenu] = useState(false);
  const { styles } = useTheme2024({ getStyle });
  const [dbData, setDbData] = useState<HistoryDisplayItem[]>([]);
  const PAGE_COUNT = isInTokenDetail ? REALL_TIME_API_PAGE_COUNT : _PAGE_COUNT;
  const {
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
    sceneCurrentAccountDepKey,
  } = useSceneAccountInfo({
    forScene: isForMultipleAdderss ? 'MultiHistory' : 'History',
  });
  const [historySuccessList, setHistorySuccessList] = useState<string[]>(
    transactionHistoryService.getSucceedList(),
  );

  const { syncTop10History, syncSingleAddress } =
    useSyncHistoryDB(unionAccounts);
  const { projectDict, tokenDict, historyEnsureNoData } = useHistoryTokenDict();

  const batchFetchDataV2 = async () => {
    // fetch data from local database

    const addresses = isSceneUsingAllAccounts
      ? unionAccounts.map(account => account.address.toLowerCase())
      : [finalSceneCurrentAccount?.address.toLowerCase()!];
    console.log('batchFetchDataV2 addresses', addresses);
    const fetchHistoryFromDbData = async (isFirst?: boolean) => {
      const [localHistoryList, _historyList, swapList, buyList] =
        await Promise.all([
          LocalHistoryItemEntity.getAllHistoryItemSortedByTime(
            addresses,
            isFirst ? 20 : 10000,
          ),
          HistoryItemEntity.getAllHistoryItemSortedByTime(
            addresses,
            isFirst ? 50 : 10000,
            isFirst, // first not show scam tx
          ),
          SwapItemEntity.getAllHistoryItem(addresses, isFirst ? 20 : 10000),
          BuyItemEntity.getAllHistoryItem(addresses, isFirst ? 20 : 10000),
        ]);

      const historyList: HistoryItemEntity[] = unionBy(
        localHistoryList.concat(_historyList),
        item => item._db_id,
      );

      if (isFirst) {
        setCurrentNoDbData(historyList.length === 0);
      }

      const pinedQueue = preferenceService.getPinToken();
      const list = historyList.map(item => {
        const localBuyItem = buyList.find(
          e =>
            e.receive_tx_id === item.txHash &&
            e.receive_chain_id === item.chain,
        );
        return {
          ...ensureHistoryListItemFromDb(item),
          isLocalBuy: !!localBuyItem,
          buyDetails: localBuyItem,
          isLocalSwap: swapList.some(e => e.tx_id === item.txHash),
          isSmallUsdTx: judgeIsSmallUsdTx(item, tokenDict, pinedQueue),
          tokenDict,
          projectDict,
          isShowSuccess: historySuccessList.includes(
            `${item.owner_addr}-${item.txHash}`,
          ),
        } as HistoryDisplayItem;
      });

      setDbData(list);
      return list;
    };
    if (!dbData.length) {
      // first init 50 count
      await fetchHistoryFromDbData(true);
    }

    // later fetch all data
    const list = await fetchHistoryFromDbData(false);
    return list;
  };

  const isNeedFetchFromApi = useMemo(() => {
    const isUseingContactsOrSafe =
      !isSceneUsingAllAccounts &&
      (finalSceneCurrentAccount?.type === KEYRING_CLASS.WATCH ||
        finalSceneCurrentAccount?.type === KEYRING_CLASS.GNOSIS);
    return isInTokenDetail || isUseingContactsOrSafe;
  }, [isSceneUsingAllAccounts, finalSceneCurrentAccount, isInTokenDetail]);

  const batchFetchData = async () => {
    const list: HistoryDisplayItem[] = [];

    if (!isNeedFetchFromApi) {
      const res = await batchFetchDataV2();
      if (!isReady.current) {
        isReady.current = true;
      }
      return { list: res };
    } else {
      const accountList = isSceneUsingAllAccounts
        ? unionAccounts
        : [finalSceneCurrentAccount];
      const addresses = isSceneUsingAllAccounts
        ? unionAccounts.map(account => account.address.toLowerCase())
        : [finalSceneCurrentAccount?.address.toLowerCase()!];

      // just for single token history
      const swapList = await SwapItemEntity.getAllHistoryItem(addresses);
      const buyList = await BuyItemEntity.getAllHistoryItem(addresses);

      const queue = new PQueue({
        interval: 2000,
        intervalCap: 10,
      });
      for (let i = 0; i < accountList.length; i++) {
        queue.add(async () => {
          const account = accountList[i];
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
              const localBuyItem = buyList.find(
                e =>
                  e.receive_tx_id === item.id &&
                  e.receive_chain_id === item.chain,
              );
              return {
                ...item,
                isLocalBuy: !!localBuyItem,
                buyDetails: localBuyItem as unknown as any,
                isLocalSwap: swapList.some(e => e.tx_id === item.id),
                account,
                // isSmallUsdTx: judgeIsSmallUsdTxInApi(item, tokenDict, pinedQueue),
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
      return { list: list };
    }
  };

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

      const {
        project_dict,
        cate_dict,
        token_dict,
        token_uuid_dict,
        history_list: list,
      } = res;
      const displayList = list
        .map(item => ({
          ...item,
          projectDict: project_dict,
          cateDict: cate_dict,
          tokenDict: token_dict || token_uuid_dict,
          address,
          key: `${address}_${item.chain}_${item.id}`,
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
    const accountList = isSceneUsingAllAccounts
      ? unionAccounts
      : [finalSceneCurrentAccount];
    for (let i = 0; i < accountList.length; i++) {
      const account = accountList[i];
      if (!account) {
        continue;
      }
      const addr = account.address.toLowerCase();
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
              !!allTxHistory.find(tx => {
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
    setCurrentPage(0);
    runFetchLocalTx();

    if (isNeedFetchFromApi) {
      reloadAsync();
    } else {
      isSceneUsingAllAccounts
        ? syncTop10History(true)
        : syncSingleAddress(finalSceneCurrentAccount?.address.toLowerCase()!);
    }
  });

  useEffect(() => {
    if (isReady.current) {
      if (!isNeedFetchFromApi) {
        batchFetchDataV2();
        runFetchLocalTx();
      } else {
        cancel();
        refresh();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneCurrentAccountDepKey, isSceneUsingAllAccounts]);

  const {
    data: _data,
    loading,
    loadingMore,
    loadMore,
    reloadAsync,
    cancel,
  } = useInfiniteScroll(() => batchFetchData(), {
    isNoMore: () => {
      if (!isNeedFetchFromApi) {
        return true;
      }
      return Object.values(hasMoreMap.current).every(item => !item);
    },
    onSuccess() {
      setCurrentPage(currentPage + 1);
      runFetchLocalTx();
    },
  });

  const thorttleBatchFetchData = debounce(batchFetchData, 1000);

  useAppOrmSyncEvents({
    taskFor: ['all-history', 'swap-history'],
    onRemoteDataUpserted: ctx => {
      switch (ctx.taskFor) {
        case 'swap-history':
        case 'all-history':
          thorttleBatchFetchData();
          break;
        default:
          break;
      }
    },
  });

  const data = useMemo(() => {
    return isNeedFetchFromApi ? _data : { list: dbData };
  }, [_data, isNeedFetchFromApi, dbData]);

  const allTxHistory = useMemo(() => {
    // make receive front of send by cate_id order by asc
    return orderBy(data?.list || [], ['time_at', 'cate_id'], ['desc', 'asc']);
  }, [data]);

  useMount(() => {
    const list = transactionHistoryService.getSucceedList();
    setHistorySuccessList(list);
    transactionHistoryService.clearSuccessAndFailList();
  });

  const displayList = useMemo(() => {
    return allTxHistory
      .filter(tx => {
        if (isShowAll) {
          // show all
          return true;
        } else {
          if (tx.isSmallUsdTx || tx.is_scam) {
            return false;
          }
          return true;
        }
      })
      .filter(tx => {
        if (isSceneUsingAllAccounts) {
          return true;
        }
        return isSameAddress(
          finalSceneCurrentAccount?.address || '',
          tx.address,
        );
      });
    // .slice(0, (currentPage + 1) * PAGE_COUNT);
  }, [
    allTxHistory,
    isShowAll,
    // currentPage,
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
  ]);

  useFocusEffect(() => {
    eventBus.addListener(EVENTS.RELOAD_TX, runFetchLocalTx);
    return () => {
      eventBus.removeListener(EVENTS.RELOAD_TX, runFetchLocalTx);
    };
  });

  const getHeaderRight = useMemoizedFn(() => {
    return <HistoryFilterMenu setIsShowMenu={setIsShowMenu} />;
  });

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const getHeaderTitle = useCallback(() => {
    return (
      <ScreenHeaderAccountSwitcher
        forScene={isForMultipleAdderss ? 'MultiHistory' : 'History'}
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
        disableSwitch={!isForMultipleAdderss}
      />
    );
  }, [tokenItem, isForMultipleAdderss, styles.titleText, styles.headerTitle]);

  const resetTopMenu = useCallback(() => {
    setIsShowMenu(false);
  }, [setIsShowMenu]);

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

  const ensureCurrentNoDbData = useMemo(() => {
    if (isNeedFetchFromApi) {
      return false;
    }

    const addresses = isSceneUsingAllAccounts
      ? unionAccounts.map(account => account.address.toLowerCase())
      : [finalSceneCurrentAccount?.address.toLowerCase()!];
    const isNodata = addresses.every(address => {
      return historyEnsureNoData[address];
    });
    return isNodata;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEnsureNoData, sceneCurrentAccountDepKey]);

  const fetchFromDbLoading = useMemo(
    () =>
      currentNoDbData &&
      !allTxHistory.length &&
      !groups?.length &&
      !ensureCurrentNoDbData,
    [
      currentNoDbData,
      allTxHistory.length,
      groups?.length,
      ensureCurrentNoDbData,
    ],
  );

  // if (!loading && !groups?.length && !allTxHistory.length) {
  //   return <Empty />;
  // }

  return (
    <View
      // onPress={() => {
      //   setIsShowMenu(false);
      // }}
      // eslint-disable-next-line react-native/no-inline-styles
      style={{ paddingTop: 0, position: 'relative' }}>
      <>
        {isShowMenu && (
          <View style={styles.menuContainer}>
            <View style={styles.menuItem}>
              <Text style={styles.menuItemText}>
                {t('page.transactions.ShowHiddenItems')}
              </Text>
              <View style={styles.valueView}>
                <AppSwitch2024 value={isShowAll} onValueChange={setIsShowAll} />
              </View>
            </View>
            {/* <View style={styles.menuItem}>
              <Text style={styles.menuItemText}>
                {t('page.transactions.ViewSmallItems')}
              </Text>
              <View style={styles.valueView}>
                <AppSwitch2024
                  value={isShowSmall}
                  onValueChange={setIsShowSmall}
                />
              </View>
            </View> */}
          </View>
        )}
        {/* {isTestnet || isInTokenDetail ? null : (
        <TouchableOpacity
          onPress={() => {
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.HistoryFilterScam,
              params: {
                addresses: isSceneUsingAllAccounts
                  ? unionAccounts
                  : [finalSceneCurrentAccount],
                isForMultipleAdderss,
              },
            });
          }}
          style={styles.link}>
          <Text style={styles.linkText}>Hide scam transactions</Text>
          <RcIconRight />
        </TouchableOpacity>
      )} */}
        <HistoryList
          resetTopMenu={resetTopMenu}
          historySuccessList={historySuccessList}
          list={[...(groups || []), ...(displayList || [])]}
          localTxList={groups}
          loading={isNeedFetchFromApi ? loading : fetchFromDbLoading}
          ensureCurrentNoDbData={ensureCurrentNoDbData}
          loadingMore={loadingMore}
          refreshLoading={isNeedFetchFromApi && loading}
          isForMultipleAdderss={isForMultipleAdderss}
          loadMore={loadMore}
          onRefresh={refresh}
        />
      </>
    </View>
  );
}

const HistoryScreen = ({ isForMultipleAdderss = true }) => {
  const {
    sheetModalRef: tokenDetailModalRef,
    cleanFocusingToken,
    focusingToken,
    tokenDetailAddress,
    setTokenDetailAddress,
  } = useGeneralTokenDetailSheetModal();
  useLastUsedAccountInScreen();

  const { styles } = useTheme2024({ getStyle });
  // const { isSceneUsingAllAccounts } = useSceneAccountInfo({
  //   forScene: 'MultiHistory',
  // });

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      {isForMultipleAdderss && (
        <AccountSwitcherModal
          forScene="MultiHistory"
          inScreen
          // panelLinearGradientProps={{ type: 'tx-page' }}
        />
      )}
      <ScreenSpecificStatusBar screenName={RootNames.History} />
      <History isTestnet={false} isForMultipleAdderss={isForMultipleAdderss} />
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

  return <HistoryScreen isForMultipleAdderss={false} />;
};

HistoryScreen.ForSingleAddress = ForSingleAddress;

export default HistoryScreen;
