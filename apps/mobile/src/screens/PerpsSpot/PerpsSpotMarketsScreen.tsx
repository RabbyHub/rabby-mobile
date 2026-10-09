import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { RcNextLeftCC } from '@/assets/icons/common';
import { Text } from '@/components/Typography';
import { NextSearchBar } from '@/components2024/SearchBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import {
  filterSpotMarkets,
  formatSpotPrice,
  getSpotMarketDisplayName,
  sortSpotMarkets,
  type SpotMarket,
} from '@/hooks/perps/spot/spotMarkets';
import { usePerpsSpotData } from '@/hooks/perps/spot/usePerpsSpotData';
import { useTheme2024 } from '@/hooks/theme';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';

const SpotMarketRow: React.FC<{
  market: SpotMarket;
  onPress: (market: SpotMarket) => void;
}> = React.memo(({ market, onPress }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(market)}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>{market.baseName}</Text>
        <Text style={styles.rowSub}>{getSpotMarketDisplayName(market)}</Text>
      </View>
      <Text style={styles.rowPrice}>
        {market.midPx ? formatSpotPrice(market.midPx, market.szDecimals) : '-'}
      </Text>
    </TouchableOpacity>
  );
});

export const PerpsSpotMarketsScreen: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const [search, setSearch] = useState('');
  const { markets, isLoading, isError } = usePerpsSpotData({
    withAccount: false,
  });

  const sortedMarkets = useMemo(() => sortSpotMarkets(markets), [markets]);
  const list = useMemo(
    () => filterSpotMarkets(sortedMarkets, search),
    [sortedMarkets, search],
  );

  const handleGoBack = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const handleSelect = useCallback((market: SpotMarket) => {
    Keyboard.dismiss();
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.PerpsSpotTrade,
      params: { pairIndex: market.pairIndex },
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SpotMarket }) => (
      <SpotMarketRow market={item} onPress={handleSelect} />
    ),
    [handleSelect],
  );

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <TouchableOpacity hitSlop={12} onPress={handleGoBack}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
        </TouchableOpacity>
        <NextSearchBar
          style={styles.searchBar}
          placeholder={t('page.perpsSpot.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          onCancel={() => setSearch('')}
          returnKeyType="done"
        />
      </View>
      {isLoading ? (
        <View style={styles.center}>
          {isError ? (
            <Text style={styles.emptyText}>
              {t('page.perpsSpot.loadError')}
            </Text>
          ) : (
            <ActivityIndicator color={colors2024['neutral-foot']} />
          )}
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={list}
          keyExtractor={item => item.coin}
          keyboardShouldPersistTaps="handled"
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('page.perpsSpot.empty')}</Text>
            </View>
          }
        />
      )}
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    paddingHorizontal: 20,
    paddingLeft: 14,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  searchBar: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  center: { paddingTop: 120, alignItems: 'center' },
  emptyText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  rowLeft: { gap: 2 },
  rowTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  rowSub: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
  rowPrice: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
