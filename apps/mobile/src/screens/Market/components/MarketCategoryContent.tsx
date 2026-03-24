import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useIsFocused } from '@react-navigation/native';
import { TokenMarketTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useAtom } from 'jotai';
import { Tabs, useFocusedTab } from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';

import TokenHeader, { SortState } from '../../Meme/components/TokenHeader';
import {
  TokenItemSkeleton,
  TokenListItem,
} from '../../Meme/components/TokenItem';
import { useTokenMarketTokenList } from '../../Meme/hooks/useTokenMarketTokenList';
import { matomoRequestEvent } from '@/utils/analytics';

const isAndroid = Platform.OS === 'android';

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
}: {
  categoryId: string;
  sortFields: string[];
  headerSpacerHeight?: number;
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

  const supportedSortFields = useMemo(
    () => new Set(sortFields || []),
    [sortFields],
  );
  const leftHeaderLabel = useMemo(
    () =>
      categoryId === 'meme' ? undefined : t('page.market.tokenHeader.name'),
    [categoryId, t],
  );

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
    refreshTokenListSilently,
  } = useTokenMarketTokenList(categoryId, orderBy, order);

  const isFocused = useIsFocused();
  const focusedTab = useFocusedTab();
  const [isInFirst100Items, setIsInFirst100Items] = useState(true);

  const handleVolumeSort = useCallback(() => {
    if (!supportedSortFields.has('volume_24h')) {
      return;
    }
    setVolumeSort(prev => toggleSort(prev));
    setFdvSort('default');
    setChangeSort('default');
  }, [setChangeSort, setFdvSort, setVolumeSort, supportedSortFields]);

  const handleFdvSort = useCallback(() => {
    if (!supportedSortFields.has('fdv')) {
      return;
    }
    setFdvSort(prev => toggleSort(prev));
    setVolumeSort('default');
    setChangeSort('default');
  }, [setChangeSort, setFdvSort, setVolumeSort, supportedSortFields]);

  const handleChangeSort = useCallback(() => {
    if (!supportedSortFields.has('price_change_24h')) {
      return;
    }
    setChangeSort(prev => toggleSort(prev));
    setVolumeSort('default');
    setFdvSort('default');
  }, [setChangeSort, setFdvSort, setVolumeSort, supportedSortFields]);

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
      if (viewableItems.length > 0) {
        const firstVisibleIndex = viewableItems[0]?.index;
        if (typeof firstVisibleIndex === 'number' && firstVisibleIndex >= 0) {
          setIsInFirst100Items(firstVisibleIndex < 100);
        }
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 0,
  });

  React.useEffect(() => {
    if (!isFocused || focusedTab !== categoryId || !isInFirst100Items) {
      return;
    }

    const timer = setInterval(() => {
      refreshTokenListSilently();
    }, 10000);

    return () => {
      clearInterval(timer);
    };
  }, [
    categoryId,
    focusedTab,
    isFocused,
    isInFirst100Items,
    refreshTokenListSilently,
  ]);

  const renderListHeaderComponent = useCallback(
    () => (
      <>
        {!!headerSpacerHeight && (
          <View style={[styles.header, { height: headerSpacerHeight }]} />
        )}
        <View style={styles.stickyHeader}>
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
        </View>
      </>
    ),
    [
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
      viewabilityConfig={viewabilityConfig.current}
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
