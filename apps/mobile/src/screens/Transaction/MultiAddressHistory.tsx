import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import RcIconRight from '@/assets/icons/history/icon-right.svg';
import { RootNames } from '@/constant/layout';

import { openapi } from '@/core/request';
import { transactionHistoryService } from '@/core/services';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { findChain, findChainByServerID } from '@/utils/chain';
import { EVENTS, eventBus } from '@/utils/events';
import {
  useInfiniteScroll,
  useInterval,
  useMemoizedFn,
  useRequest,
} from 'ahooks';
import PQueue from 'p-queue';
import { last, unionBy, orderBy, set } from 'lodash';
import { Text, TouchableWithoutFeedback, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TxHistoryItem,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { Empty } from './components/Empty';
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
import { AbstractPortfolioToken } from '../Home/types';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { AssetAvatar } from '@/components';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import { HistoryFilterMenu } from './components/HistoryFilterMenu';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { strings } from '@/utils/i18n';

const PAGE_COUNT = 2000;

export interface HistoryDisplayItem extends TxHistoryItem {
  projectDict: TxHistoryResult['project_dict'];
  cateDict: TxHistoryResult['cate_dict'];
  tokenDict: TxHistoryResult['token_dict'];
  address: string;
  key: string;
  account?: KeyringAccountWithAlias;
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
  const { accounts } = useMyAccounts();
  const route = useRoute();
  const { tokenItem, isInTokenDetail, isMultiAddress } = (route.params ||
    {}) as {
    tokenItem: AbstractPortfolioToken;
    isInTokenDetail?: boolean;
    isMultiAddress?: boolean;
  };
  const unionAccounts = useMemo(() => {
    return unionBy(accounts, account => account.address.toLowerCase());
  }, [accounts]);
  const isReady = useRef(false);
  const lastMap = useRef<Record<string, number>>({});
  const hasMoreMap = useRef<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [isShowAll, setIsShowAll] = useState(false);
  const [isShowMenu, setIsShowMenu] = useState(false);
  const { styles } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();
  const { bottom } = useSafeAreaInsets();
  const {
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
    sceneCurrentAccountDepKey,
  } = useSceneAccountInfo({
    forScene: isForMultipleAdderss ? 'MultiHistory' : 'History',
  });

  const batchFetchData = async () => {
    const list: HistoryDisplayItem[] = [];
    const accountList = isSceneUsingAllAccounts
      ? unionAccounts
      : [finalSceneCurrentAccount];
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
          : await fetchDataV2(addr, lastMap.current[addr] || 0);

        if (result.list.length < PAGE_COUNT) {
          hasMoreMap.current[addr] = false;
        } else {
          hasMoreMap.current[addr] = true;
        }
        lastMap.current[addr] = result.last || 0;
        list.push(
          ...result.list.map(item => ({
            ...item,
            account,
          })),
        );
      });
    }
    if (!isReady.current) {
      isReady.current = true;
    }
    if (accountList.length > 0) {
      await waitQueueFinished(queue);
    }
    return { list };
  };

  const fetchDataV2 = async (
    address: string,
    startTime = 0,
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

    console.log('fetchDataV2', address, startTime);
    const getHistory = openapi.getAllTxHistory;
    try {
      const res = await getHistory({
        id: address,
        start_time: startTime,
      });

      const {
        project_dict,
        cate_dict,
        token_uuid_dict: token_dict,
        history_list: list,
      } = res;
      const displayList = list
        .map(item => ({
          ...item,
          projectDict: project_dict,
          cateDict: cate_dict,
          tokenDict: token_dict,
          address,
          key: `${address}_${item.chain}_${item.id}`,
        }))
        .sort((v1, v2) => v2.time_at - v1.time_at);

      console.debug('fetchDataV2', displayList.length);
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

    const getHistory = openapi.listTxHisotry;
    try {
      const res = await getHistory({
        id: address,
        start_time: startTime,
        page_count: PAGE_COUNT,
        chain_id,
        token_id,
      });

      const { project_dict, cate_dict, token_dict, history_list: list } = res;
      const displayList = list
        .map(item => ({
          ...item,
          projectDict: project_dict,
          cateDict: cate_dict,
          tokenDict: token_dict,
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
              item.createdAt >= Date.now() - 3600000 &&
              !item.isSubmitFailed &&
              !isSynced
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
    reloadAsync();
  });

  useEffect(() => {
    if (isReady.current) {
      cancel();
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneCurrentAccountDepKey, isSceneUsingAllAccounts]);

  const { data, loading, loadingMore, loadMore, reloadAsync, cancel } =
    useInfiniteScroll(() => batchFetchData(), {
      isNoMore: () => {
        return Object.values(hasMoreMap.current).every(item => !item);
      },
      onSuccess() {
        setCurrentPage(currentPage + 1);
        runFetchLocalTx();
      },
    });

  const allTxHistory = useMemo(() => {
    return orderBy(data?.list || [], 'time_at', 'desc');
  }, [data]);

  const displayList = useMemo(() => {
    return allTxHistory
      .filter(tx => {
        if (!isShowAll) {
          return !tx.is_scam;
        }
        if (isSceneUsingAllAccounts) {
          return true;
        }
        return isSameAddress(
          finalSceneCurrentAccount?.address || '',
          tx.address,
        );
      })
      .slice(0, (currentPage + 1) * PAGE_COUNT);
  }, [
    allTxHistory,
    isShowAll,
    currentPage,
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
  ]);

  useFocusEffect(() => {
    eventBus.addListener(EVENTS.RELOAD_TX, refresh);
    return () => {
      eventBus.removeListener(EVENTS.RELOAD_TX, refresh);
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
            <Text style={styles.titleText}>{tokenItem.symbol}</Text>
            <Text style={styles.titleText}>Transactions</Text>
          </View>
        }
        disableSwitch={!isForMultipleAdderss}
      />
    );
  }, [tokenItem, isForMultipleAdderss, styles.titleText, styles.headerTitle]);

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

  const isFirstLoading = loading && !allTxHistory.length;

  if (!loading && !groups?.length && !allTxHistory.length) {
    return <Empty />;
  }

  return (
    <View
      // onPress={() => {
      //   setIsShowMenu(false);
      // }}
      // eslint-disable-next-line react-native/no-inline-styles
      style={{ paddingBottom: bottom, paddingTop: 0, position: 'relative' }}>
      <>
        {isShowMenu && (
          <View style={styles.menuContainer}>
            <Text style={styles.menuItemText}>
              {strings('page.transactions.ViewHiddenItems')}
            </Text>
            <View style={styles.valueView}>
              <AppSwitch2024 value={isShowAll} onValueChange={setIsShowAll} />
            </View>
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
          list={[...(groups || []), ...(displayList || [])]}
          localTxList={groups}
          loading={isFirstLoading}
          loadingMore={loadingMore}
          refreshLoading={loading}
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
  const { isSceneUsingAllAccounts } = useSceneAccountInfo({
    forScene: 'MultiHistory',
  });

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      {isForMultipleAdderss && (
        <AccountSwitcherModal
          forScene="MultiHistory"
          inScreen
          panelLinearGradientProps={{ type: 'bg1' }}
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
        onTriggerDismissFromInternal={ctx => {
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
    backgroundColor: isLight ? '#F6F7F7' : colors2024['neutral-bg-1'],
  },
  menuContainer: {
    elevation: 5,
    shadowColor: 'rgba(25, 35, 60, 0.2)', // Shadow color
    shadowOffset: { width: 0, height: 12 }, // Horizontal and vertical offsets
    shadowOpacity: 0.2, // Shadow opacity
    shadowRadius: 8, // Blur radius
    flexDirection: 'row',
    zIndex: 1,
    justifyContent: 'space-between',
    position: 'absolute',
    top: 0,
    right: 16,
    alignItems: 'center',
    width: 250,
    height: 56,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 12,
    // paddingVertical: 16,
    borderRadius: 16,
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
    color: colors2024['netural-title-1'],
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
