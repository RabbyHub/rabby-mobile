import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import RcIconRight from '@/assets/icons/history/icon-right.svg';
import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { openapi } from '@/core/request';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import {
  useInfiniteScroll,
  useInterval,
  useMemoizedFn,
  useMount,
  useRequest,
} from 'ahooks';
import { last } from 'lodash';
import { StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { HistoryList } from './components/HistoryList';
import { Empty } from './components/Empty';
import { findChainByServerID } from '@/utils/chain';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EVENTS, eventBus } from '@/utils/events';
const PAGE_COUNT = 10;

function HistoryScreen(): JSX.Element {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const account = preferenceService.getCurrentAccount();
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();

  const fetchData = async (startTime = 0) => {
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
    const { pendings, completeds } = transactionHistoryService.getList(
      account.address,
    );

    return [
      ...pendings,
      ...completeds.filter(item => {
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
      }),
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
    <NormalScreenContainer
      style={{
        paddingBottom: bottom,
      }}>
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
      <HistoryList
        list={[...(groups || []), ...(data?.list || [])]}
        localTxList={groups}
        loading={isFirstLoading}
        loadingMore={loadingMore}
        loadMore={loadMore}
        onRefresh={refresh}
      />
    </NormalScreenContainer>
  );
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
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
  });

export default HistoryScreen;
