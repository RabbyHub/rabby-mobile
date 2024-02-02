import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, Text } from 'react-native';
import { HistoryList } from './components/HistoryList';
import { preferenceService } from '@/core/services';
import { openapi } from '@/core/request';
import { last } from 'lodash';
import { useRequest } from 'ahooks';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Empty } from './components/Empty';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function HistoryFilterScamScreen(): JSX.Element {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { bottom } = useSafeAreaInsets();
  const fetchData = async (startTime = 0) => {
    const account = preferenceService.getCurrentAccount();
    const address = account?.address;
    if (!address) {
      throw new Error('no account');
    }

    const getHistory = openapi.getAllTxHistory;

    const res = await getHistory({
      id: address,
      start_time: startTime,
    });

    const {
      project_dict,
      cate_dict,
      token_uuid_dict,
      history_list: list,
    } = res;
    const displayList = list
      .filter(item => !item.is_scam)
      .map(item => ({
        ...item,
        projectDict: project_dict,
        cateDict: cate_dict,
        tokenDict: token_uuid_dict,
      }))
      .sort((v1, v2) => v2.time_at - v1.time_at);
    return {
      last: last(displayList)?.time_at,
      list: displayList,
    };
  };

  const { data, loading } = useRequest(() => fetchData());

  if (!loading && !data?.list?.length) {
    return <Empty />;
  }

  return (
    <NormalScreenContainer
      style={{
        paddingBottom: bottom,
      }}>
      {loading ? (
        <Text style={styles.loadingText}>
          Loading may take a moment, and data delays are possible
        </Text>
      ) : null}
      <HistoryList loading={loading} list={data?.list} />
    </NormalScreenContainer>
  );
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    loadingText: {
      color: colors['neutral-body'],
      fontSize: 12,
      lineHeight: 14,
      marginBottom: 20,
      textAlign: 'center',
    },
  });

export default HistoryFilterScamScreen;
