/* eslint-disable react-native/no-inline-styles */
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';
import { PerpsMarketItem } from './components/PerpsMarketItem';
import { MarketData, usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { sortBy } from 'lodash';

export const PerpsMarketListScreen = () => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();
  const { state } = usePerpsStore();

  const data = React.useMemo(() => {
    return sortBy(state.marketData, item => -(item.dayNtlVlm || 0));
  }, [state.marketData]);

  const renderItem = useMemoizedFn(
    ({ item, index }: { item: MarketData; index: number }) => {
      return (
        <PerpsMarketItem
          onPress={() => {
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.PerpsMarketDetail,
              params: {
                market: item.name,
              },
            });
          }}
          item={item}
          index={index + 1}
        />
      );
    },
  );

  return (
    <NormalScreenContainer2024 type="bg2">
      <View style={styles.container}>
        <FlatList
          style={styles.list}
          data={data}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          keyExtractor={(item, index) => `market-item-${index}`}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={[styles.listColText, styles.listColNumber]}>#</Text>
              <Text style={[styles.listColText, styles.listColPerps]}>
                Perps
              </Text>
              <Text style={[styles.listColText, styles.listColVolume]}>
                24h Volume
              </Text>
            </View>
          }
        />
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
  list: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  listColText: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  listColNumber: {
    width: 17,
  },
  listColPerps: { flex: 1 },
  listColVolume: {
    textAlign: 'right',
  },
  divider: {
    height: 8,
  },
}));
