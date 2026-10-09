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
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { Text } from '@/components/Typography';
import { NextSearchBar } from '@/components2024/SearchBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useSpotTokenLogos } from '@/hooks/perps/spot/spotLogos';
import {
  buildSpotOpenOrderItems,
  filterSpotMarkets,
  filterSpotMarketsByTab,
  getSpotHeldTokenIndexes,
  sortSpotMarkets,
  type SpotMarket,
  type SpotMarketFilter,
  type SpotMarketSort,
} from '@/hooks/perps/spot/spotMarkets';
import { usePerpsSpotData } from '@/hooks/perps/spot/usePerpsSpotData';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';

import { SpotMarketRow } from './components/SpotMarketRow';

const FILTERS: SpotMarketFilter[] = ['all', 'holdings', 'favorites'];

export const PerpsSpotMarketsScreen: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SpotMarketFilter>('all');
  const [sort, setSort] = useState<SpotMarketSort>('volume');
  const { markets, isLoading, isError, account, currentPerpsAccount } =
    usePerpsSpotData({ withAccount: true });
  const favoriteMarkets = perpsStore(s => s.favoriteMarkets);
  const logos = useSpotTokenLogos(markets);

  const openOrderCount = useMemo(
    () => buildSpotOpenOrderItems(account?.openOrders, markets).length,
    [account?.openOrders, markets],
  );
  const heldTokenIndexes = useMemo(
    () => getSpotHeldTokenIndexes(account?.balances),
    [account?.balances],
  );
  const heldByToken = useMemo(() => {
    const map = new Map<number, string>();
    for (const balance of account?.balances ?? []) {
      if (Number(balance.total) > 0) {
        map.set(balance.token, balance.total);
      }
    }
    return map;
  }, [account?.balances]);

  const sortedMarkets = useMemo(
    () => sortSpotMarkets(markets, sort),
    [markets, sort],
  );
  const list = useMemo(
    () =>
      filterSpotMarkets(
        filterSpotMarketsByTab(sortedMarkets, filter, {
          heldTokenIndexes,
          favoriteMarkets,
        }),
        search,
      ),
    [sortedMarkets, filter, heldTokenIndexes, favoriteMarkets, search],
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

  const handleOpenPortfolio = useCallback(() => {
    Keyboard.dismiss();
    naviPush(RootNames.StackTransaction, { screen: RootNames.PerpsSpotOrders });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SpotMarket }) => (
      <SpotMarketRow
        market={item}
        logo={logos[item.baseName] || ''}
        held={heldByToken.get(item.baseTokenIndex)}
        onPress={handleSelect}
      />
    ),
    [handleSelect, logos, heldByToken],
  );

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <TouchableOpacity hitSlop={12} onPress={handleGoBack}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('page.perpsSpot.title')}</Text>
        {!!currentPerpsAccount && (
          <TouchableOpacity
            style={styles.ordersBtn}
            hitSlop={8}
            onPress={handleOpenPortfolio}>
            <Text style={styles.ordersBtnText}>
              {t('page.perpsSpot.portfolioEntry')}
            </Text>
            {openOrderCount > 0 && (
              <View style={styles.ordersBadge}>
                <Text style={styles.ordersBadgeText}>{openOrderCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
      <NextSearchBar
        style={styles.searchBar}
        placeholder={t('page.perpsSpot.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
        onCancel={() => setSearch('')}
        returnKeyType="done"
      />
      <View style={styles.chips}>
        {FILTERS.map(item => {
          const active = item === filter;
          const disabled = item === 'holdings' && !currentPerpsAccount;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, active && styles.chipActive]}
              disabled={disabled}
              onPress={() => setFilter(item)}>
              {item === 'favorites' && (
                <RcIconFavorite
                  width={14}
                  height={14}
                  color={
                    active
                      ? colors2024['neutral-bg-1']
                      : colors2024['neutral-foot']
                  }
                />
              )}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(`page.perpsSpot.filter.${item}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, styles.sortChip]}
          onPress={() => setSort(sort === 'volume' ? 'name' : 'volume')}>
          <Text style={styles.chipText}>
            {t(`page.perpsSpot.sort.${sort}`)}
          </Text>
        </TouchableOpacity>
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
              <Text style={styles.emptyText}>
                {t(
                  filter === 'favorites'
                    ? 'page.perpsSpot.noFavorites'
                    : filter === 'holdings'
                    ? 'page.perpsSpot.noHoldings'
                    : 'page.perpsSpot.empty',
                )}
              </Text>
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
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  title: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  searchBar: { marginHorizontal: 20, marginBottom: 10 },
  ordersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  ordersBtnText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  ordersBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['brand-default'],
  },
  ordersBadgeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: colors2024['neutral-bg-1'],
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  chipActive: { backgroundColor: colors2024['neutral-title-1'] },
  sortChip: { marginLeft: 'auto' },
  chipText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-foot'],
  },
  chipTextActive: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-bg-1'],
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  center: { paddingTop: 120, alignItems: 'center' },
  emptyText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
}));
