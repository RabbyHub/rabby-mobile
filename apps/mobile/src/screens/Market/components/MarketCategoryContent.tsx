import React, { useCallback, useMemo } from 'react';
import { Platform, RefreshControl, View, ViewToken } from 'react-native';

import { RootNames } from '@/constant/layout';
import { atomByMMKV } from '@/core/storage/mmkv';
import { useTheme2024 } from '@/hooks/theme';
import {
  buildMarketTokenDetailFrom,
  getMarketTabClickListAction,
} from '@/screens/Market/analytics';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { memeItemToITokenItem } from '@/utils/token';
import { TokenMarketTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useAtom } from 'jotai';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';

import TokenHeader, { SortState } from '../../Meme/components/TokenHeader';
import {
  TokenItemSkeleton,
  TokenListItem,
} from '../../Meme/components/TokenItem';
import { useTokenMarketTokenList } from '../../Meme/hooks/useTokenMarketTokenList';
import { matomoRequestEvent } from '@/utils/analytics';
import WatchListHeader from '../../Watchlist/components/TokenHeader';
import { marketRealtimePriceAtom } from '../atom';
import { useSetAtom } from 'jotai';

const isAndroid = Platform.OS === 'android';
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 0,
};

type SortOrder = 'desc' | 'asc';

const toggleSort = (prev: SortState): SortState => {
  if (prev === 'default') {
    return 'desc';
  }
  if (prev === 'desc') {
    return 'asc';
  }
  return 'default';
};

export function MarketCategoryContent({
  categoryId,
  sortFields,
  headerSpacerHeight = isAndroid ? 46 : 44,
  onVisibleUuidsChange,
}: {
  categoryId: string;
  sortFields: string[];
  headerSpacerHeight?: number;
  onVisibleUuidsChange?: (uuids: string[]) => void;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const volumeSortAtom = useMemo(
    () => atomByMMKV<SortState>(`@market.${categoryId}.volumeSort`, 'default'),
    [categoryId],
  );
  const fdvSortAtom = useMemo(
    () => atomByMMKV<SortState>(`@market.${categoryId}.fdvSort`, 'default'),
    [categoryId],
  );
  const changeSortAtom = useMemo(
    () => atomByMMKV<SortState>(`@market.${categoryId}.changeSort`, 'default'),
    [categoryId],
  );
  const [volumeSort, setVolumeSort] = useAtom(volumeSortAtom);
  const [fdvSort, setFdvSort] = useAtom(fdvSortAtom);
  const [changeSort, setChangeSort] = useAtom(changeSortAtom);
  const setMarketRealtimePrice = useSetAtom(marketRealtimePriceAtom);

  const supportedSortFields = useMemo(
    () => new Set(sortFields || []),
    [sortFields],
  );
  const leftHeaderLabel = useMemo(() => {
    if (categoryId === 'meme') {
      return undefined;
    }
    if (categoryId === 'stock' || categoryId === 'commodities') {
      return t('page.market.tokenHeader.tokenAndName');
    }
    return t('page.market.tokenHeader.name');
  }, [categoryId, t]);

  const { orderBy, order } = useMemo(() => {
    if (supportedSortFields.has('volume_24h') && volumeSort !== 'default') {
      return {
        orderBy: 'volume_24h',
        order: volumeSort as SortOrder,
      };
    }
    if (supportedSortFields.has('fdv') && fdvSort !== 'default') {
      return {
        orderBy: 'fdv',
        order: fdvSort as SortOrder,
      };
    }
    if (
      supportedSortFields.has('price_change_24h') &&
      changeSort !== 'default'
    ) {
      return {
        orderBy: 'price_change_24h',
        order: changeSort as SortOrder,
      };
    }
    return {
      orderBy: undefined,
      order: undefined,
    };
  }, [changeSort, fdvSort, supportedSortFields, volumeSort]);

  const {
    tokenList: list,
    getTokenList,
    loading: tokenListLoading,
    loadingMore,
    hasMore,
    loadMore,
  } = useTokenMarketTokenList(categoryId, orderBy, order);

  const clearCurrentListRealtimePrice = useCallback(() => {
    setMarketRealtimePrice({});
  }, [setMarketRealtimePrice]);

  const handleVolumeSort = useCallback(() => {
    if (!supportedSortFields.has('volume_24h')) {
      return;
    }
    clearCurrentListRealtimePrice();
    setVolumeSort(prev => toggleSort(prev));
    setFdvSort('default');
    setChangeSort('default');
  }, [
    clearCurrentListRealtimePrice,
    setChangeSort,
    setFdvSort,
    setVolumeSort,
    supportedSortFields,
  ]);

  const handleFdvSort = useCallback(() => {
    if (!supportedSortFields.has('fdv')) {
      return;
    }
    clearCurrentListRealtimePrice();
    setFdvSort(prev => toggleSort(prev));
    setVolumeSort('default');
    setChangeSort('default');
  }, [
    clearCurrentListRealtimePrice,
    setChangeSort,
    setFdvSort,
    setVolumeSort,
    supportedSortFields,
  ]);

  const handleChangeSort = useCallback(() => {
    if (!supportedSortFields.has('price_change_24h')) {
      return;
    }
    clearCurrentListRealtimePrice();
    setChangeSort(prev => toggleSort(prev));
    setVolumeSort('default');
    setFdvSort('default');
  }, [
    clearCurrentListRealtimePrice,
    setChangeSort,
    setFdvSort,
    setVolumeSort,
    supportedSortFields,
  ]);

  const handleOpenTokenDetail = useCallback(
    (token: TokenMarketTokenItem) => {
      const clickAction = getMarketTabClickListAction(categoryId);

      if (clickAction) {
        matomoRequestEvent({
          category: 'Rabby Market',
          action: clickAction,
        });
      }

      navigateDeprecated(RootNames.TokenMarketInfo, {
        token: memeItemToITokenItem(token, ''),
        unHold: false,
        needUseCacheToken: true,
        from: buildMarketTokenDetailFrom({
          categoryId,
          id: token.id,
          chain: token.chain,
          symbol: token.symbol,
        }),
      });
    },
    [categoryId],
  );

  const renderItem = useCallback(
    ({ item }: { item: TokenMarketTokenItem }) => (
      <TokenListItem
        showChainLogo={categoryId !== 'meme'}
        showFdvOnly={categoryId === 'hot'}
        item={item}
        onPress={handleOpenTokenDetail}
      />
    ),
    [handleOpenTokenDetail, categoryId],
  );

  const keyExtractor = useCallback((item: TokenMarketTokenItem) => item.id, []);

  const renderListEmptyComponent = useCallback(() => {
    if (tokenListLoading && list.length === 0) {
      return (
        <>
          {Array.from({ length: 8 }).map((_, idx) => (
            <TokenItemSkeleton key={idx} />
          ))}
        </>
      );
    }
    return null;
  }, [list.length, tokenListLoading]);

  const renderListFooterComponent = useCallback(() => {
    return (
      <View>
        {loadingMore && (
          <View style={styles.loadingMoreContainer}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <TokenItemSkeleton key={idx} />
            ))}
          </View>
        )}
        <View style={styles.bottomPadding} />
      </View>
    );
  }, [loadingMore, styles]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingMore && !tokenListLoading) {
      loadMore();
    }
  }, [hasMore, loadMore, loadingMore, tokenListLoading]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      onVisibleUuidsChange?.(
        viewableItems
          .map(item => item.item)
          .filter(Boolean)
          .map(item => `${item.chain}:${item.id}`),
      );
    },
    [onVisibleUuidsChange],
  );

  const renderListHeaderComponent = useCallback(
    () => (
      <>
        {!!headerSpacerHeight && (
          <View style={[styles.header, { height: headerSpacerHeight }]} />
        )}
        <View style={styles.stickyHeader}>
          {categoryId === 'hot' ? (
            <WatchListHeader
              tokenSort="default"
              onTokenSort={handleVolumeSort}
              fdvSort={fdvSort}
              onFdvSort={handleFdvSort}
              showFdvSort={supportedSortFields.has('fdv')}
              changeSort={changeSort}
              onChangeSort={handleChangeSort}
              disableLeftSort
            />
          ) : (
            <TokenHeader
              volumeSort={volumeSort}
              onVolumeSort={handleVolumeSort}
              fdvSort={fdvSort}
              onFdvSort={handleFdvSort}
              changeSort={changeSort}
              onChangeSort={handleChangeSort}
              showVolumeSort={supportedSortFields.has('volume_24h')}
              showFdvSort={supportedSortFields.has('fdv')}
              showChangeSort={supportedSortFields.has('price_change_24h')}
              leftLabel={leftHeaderLabel}
            />
          )}
        </View>
      </>
    ),
    [
      categoryId,
      changeSort,
      fdvSort,
      handleChangeSort,
      handleFdvSort,
      handleVolumeSort,
      headerSpacerHeight,
      leftHeaderLabel,
      styles.header,
      styles.stickyHeader,
      supportedSortFields,
      volumeSort,
    ],
  );

  return (
    <Tabs.FlatList
      data={list}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={renderListHeaderComponent}
      stickyHeaderIndices={[headerSpacerHeight ? 1 : 0]}
      ListEmptyComponent={renderListEmptyComponent}
      ListFooterComponent={renderListFooterComponent}
      contentContainerStyle={styles.scrollView}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={VIEWABILITY_CONFIG}
      refreshControl={
        <RefreshControl
          refreshing={tokenListLoading && list.length !== 0}
          onRefresh={() => getTokenList(orderBy, order)}
        />
      }
    />
  );
}

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  header: {
    height: isAndroid ? 46 : 44,
  },
  scrollView: {
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  stickyHeader: {
    paddingTop: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  bottomPadding: {
    height: 120,
  },
  loadingMoreContainer: {},
  skeletonBlock: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    width: '100%',
    height: 74,
    padding: 0,
    borderRadius: 16,
    marginTop: 8,
  },
}));
