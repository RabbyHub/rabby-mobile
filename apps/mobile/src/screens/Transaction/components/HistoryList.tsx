import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { HistoryItem } from './HistoryItem';
import { useInfiniteScroll } from 'ahooks';
import { preferenceService } from '@/core/services';
import { openapi } from '@/core/request';
import { last } from 'lodash';
import {
  TxDisplayItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
const PAGE_COUNT = 150;

export const HistoryList = ({ isFilterScam }: { isFilterScam?: boolean }) => {
  const fetchData = async (startTime = 0) => {
    const account = preferenceService.getCurrentAccount();
    const address = account?.address;
    if (!address) {
      throw new Error('no account');
    }

    const getHistory = openapi.listTxHisotry;
    const getAllTxHistory = openapi.getAllTxHistory;

    const res = isFilterScam
      ? await getAllTxHistory({
          id: address,
        })
      : await getHistory({
          id: address,
          start_time: startTime,
          page_count: PAGE_COUNT,
        });

    const { project_dict, cate_dict, history_list: list } = res;
    const displayList = list
      .map(item => ({
        ...item,
        projectDict: project_dict,
        cateDict: cate_dict,
        tokenDict:
          'token_dict' in res
            ? res.token_dict
            : 'token_uuid_dict' in res
            ? res.token_uuid_dict
            : undefined,
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
        return isFilterScam
          ? true
          : !d?.last || (d?.list.length || 0) < PAGE_COUNT;
      },
    },
  );

  const renderItem = ({ item }: { item: TxDisplayItem }) => {
    return (
      <HistoryItem
        data={item}
        projectDict={item.projectDict}
        cateDict={item.cateDict}
        tokenDict={item.tokenDict || {}}
      />
    );
  };

  return (
    <Animated.FlatList
      data={data?.list}
      renderItem={renderItem}
      windowSize={5}
      style={styles.container}
      onEndReached={() => {
        loadMore();
      }}
      onEndReachedThreshold={0.8}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
});
