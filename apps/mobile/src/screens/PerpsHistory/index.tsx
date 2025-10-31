/* eslint-disable react-native/no-inline-styles */
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { useRoute } from '@react-navigation/native';
import { sortBy } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PerpsHistoryList } from '../Perps/components/PerpsHistorySection/PerpsHistoryList';

export const PerpsHistoryScreen = () => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();
  const { state } = usePerpsStore();

  const { marketDataMap, userFills, localLoadingHistory, userAccountHistory } =
    state || {};

  const data = React.useMemo(() => {
    return sortBy(state.marketData, item => -(item.dayNtlVlm || 0));
  }, [state.marketData]);

  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'PerpsHistory'>
    >();

  const coin = route.params?.coin;

  const homeHistoryList = useMemo(() => {
    const list = [...localLoadingHistory, ...userAccountHistory, ...userFills];

    return list.sort((a, b) => b.time - a.time);
  }, [userAccountHistory, userFills, localLoadingHistory]);

  const coinHistoryList = useMemo(() => {
    return userFills
      .filter(item => item.coin === coin)
      .sort((a, b) => b.time - a.time);
  }, [coin, userFills]);

  const list = useMemo(() => {
    return coin ? coinHistoryList : homeHistoryList;
  }, [coin, coinHistoryList, homeHistoryList]);

  return (
    <NormalScreenContainer2024 type={isLight ? 'bg0' : 'bg1'}>
      <View style={styles.container}>
        <PerpsHistoryList marketDataMap={marketDataMap} historyList={list} />
      </View>
    </NormalScreenContainer2024>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
  },
}));
