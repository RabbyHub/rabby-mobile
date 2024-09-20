import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import RcIconRight from '@/assets/icons/history/icon-right.svg';
import NetSwitchTabs, {
  useSwitchNetTab,
} from '@/components/PillsSwitch/NetSwitchTabs';
import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { openapi } from '@/core/request';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { findChain, findChainByServerID } from '@/utils/chain';
import { EVENTS, eventBus } from '@/utils/events';
import {
  useInfiniteScroll,
  useInterval,
  useMemoizedFn,
  useMount,
  useRequest,
} from 'ahooks';
import { last } from 'lodash';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty } from './components/Empty';
import { HistoryList } from './components/HistoryList';
import { useCurrentAccount } from '@/hooks/account';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
const PAGE_COUNT = 10;

function History({ isTestnet = false }: { isTestnet?: boolean }): JSX.Element {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const account = preferenceService.getCurrentAccount();
  const navigation = useRabbyAppNavigation();
  const { bottom } = useSafeAreaInsets();

  const fetchData = async (startTime = 0) => {
    if (isTestnet) {
      return {
        last: 0,
        list: [],
      };
    }
    const address = account?.address;
    if (!address) {
      throw new Error('no account');
    }

    const getHistory = openapi.listTxHisotry;

    const res = await getHistory({
      id: address,
      start_time: startTime,
      page_count: PAGE_COUNT,
    });

    const { project_dict, cate_dict, token_dict, history_list: list } = res;
    const displayList = list
      .map(item => ({
        ...item,
        projectDict: project_dict,
        cateDict: cate_dict,
        tokenDict: token_dict,
      }))
      .sort((v1, v2) => v2.time_at - v1.time_at);
    return {
      last: last(displayList)?.time_at,
      list: displayList,
    };
  };

  const { data, loading, loadingMore, loadMore, reloadAsync } =
    useInfiniteScroll(d => fetchData(d?.last), {
      isNoMore: d => {
        return !d?.last || (d?.list.length || 0) < PAGE_COUNT;
      },
      onSuccess() {
        runFetchLocalTx();
      },
    });

  const fetchLocalTx = useMemoizedFn(async () => {
    if (!account?.address) {
      return [];
    }
    const { pendings: _pendings, completeds: _completeds } =
      transactionHistoryService.getList(account.address);

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
              !!data?.list?.find(tx => {
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
    return fetchLocalTx();
  });

  useInterval(() => runFetchLocalTx(), groups?.length ? 5000 : 60 * 1000);

  const refresh = useMemoizedFn(() => {
    runFetchLocalTx();
    reloadAsync();
  });

  useMount(() => {
    eventBus.addListener(EVENTS.RELOAD_TX, refresh);
    return () => {
      eventBus.removeListener(EVENTS.RELOAD_TX, refresh);
    };
  });

  const isFirstLoading = loading && !data?.list?.length;

  if (!loading && !groups?.length && !data?.list?.length) {
    return <Empty />;
  }

  return (
    <View style={{ flex: 1, paddingBottom: bottom }}>
      {isTestnet ? null : (
        <TouchableOpacity
          onPress={() => {
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.HistoryFilterScam,
              params: {},
            });
          }}
          style={styles.link}>
          <Text style={styles.linkText}>Hide scam transactions</Text>
          <RcIconRight />
        </TouchableOpacity>
      )}
      <HistoryList
        list={[...(groups || []), ...(data?.list || [])]}
        localTxList={groups}
        loading={isFirstLoading}
        loadingMore={loadingMore}
        refreshLoading={loading}
        loadMore={loadMore}
        onRefresh={refresh}
      />
    </View>
  );
}

const HistoryScreen = () => {
  const { selectedTab, onTabChange } = useSwitchNetTab();

  const { currentAccount } = useCurrentAccount();

  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <RootScreenContainer fitStatuBar style={styles.page}>
      <ScreenSpecificStatusBar screenName={RootNames.History} />
      <NetSwitchTabs
        value={selectedTab}
        onTabChange={onTabChange}
        style={styles.netTabs}
      />
      {selectedTab === 'mainnet' ? (
        <History isTestnet={false} key={'mainnet' + currentAccount?.address} />
      ) : (
        <History isTestnet={true} key={'testnet' + currentAccount?.address} />
        // <View style={styles.notFound}>
        //   <RcIconNotFindCC color={colors['neutral-body']} />
        //   <Text style={styles.notFoundText}>
        //     Not supported for custom network
        //   </Text>
        // </View>
      )}
    </RootScreenContainer>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    page: {
      backgroundColor: colors['neutral-bg-2'],
    },
    link: {
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: colors['neutral-card1'],
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 15,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    linkText: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['neutral-body'],
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
      color: colors['neutral-body'],
      marginTop: 16,
    },
  });

export default HistoryScreen;
