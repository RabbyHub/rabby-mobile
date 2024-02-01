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
  useRequest,
} from 'ahooks';
import { last } from 'lodash';
import { StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { HistoryList } from './components/HistoryList';
import { Empty } from './components/Empty';
import { findChainByServerID } from '@/utils/chain';
const PAGE_COUNT = 10;

function HistoryScreen(): JSX.Element {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const account = preferenceService.getCurrentAccount();

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

  const { data, loading, loadingMore, loadMore } = useInfiniteScroll(
    d => fetchData(d?.last),
    {
      isNoMore: d => {
        return !d?.last || (d?.list.length || 0) < PAGE_COUNT;
      },
    },
  );

  const fetchLocalTx = useMemoizedFn(async () => {
    if (!account?.address) {
      return [];
    }
    const { pendings, completeds } = transactionHistoryService.getList(
      account.address,
    );

    return [
      ...pendings,
      ...completeds.filter(
        item =>
          item.createdAt >= Date.now() - 3600000 &&
          !item.isSubmitFailed &&
          !data?.list?.find(
            tx =>
              tx.hash === item.maxGasTx.hash &&
              findChainByServerID(tx.chain)?.id === tx.chain,
          ),
      ),
    ];
  });

  const { data: groups, runAsync: runFetchLocalTx } = useRequest(async () => {
    return fetchLocalTx();
  });

  useInterval(() => runFetchLocalTx(), groups?.length ? 5000 : 60 * 1000);

  if (!loading && !groups?.length && !data?.list?.length) {
    return <Empty />;
  }

  return (
    <NormalScreenContainer>
      <TouchableOpacity
        onPress={() => navigate(RootNames.HistoryFilterScam)}
        style={styles.link}>
        <Text style={styles.linkText}>Hide scam transactions</Text>
        <RcIconRight />
      </TouchableOpacity>
      <HistoryList
        list={[...(groups || []), ...(data?.list || [])]}
        localTxList={groups}
        loading={loading}
        loadingMore={loadingMore}
        loadMore={loadMore}
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
      paddingVertical: 11,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    linkText: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-body'],
    },
  });

export default HistoryScreen;
