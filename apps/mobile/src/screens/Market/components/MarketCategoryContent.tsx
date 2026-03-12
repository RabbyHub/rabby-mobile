import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  View,
  ViewToken,
} from 'react-native';

import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { memeItemToITokenItem } from '@/utils/token';
import { useIsFocused } from '@react-navigation/native';
import { TokenMarketTokenItem } from '@rabby-wallet/rabby-api/dist/types';

import TokenHeader, { SortState } from '../../Meme/components/TokenHeader';
import {
  TokenItemSkeleton,
  TokenListItem,
} from '../../Meme/components/TokenItem';
import { useTokenMarketTokenList } from '../../Meme/hooks/useTokenMarketTokenList';

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
  const [volumeSort, setVolumeSort] = useState<SortState>('default');
  const [fdvSort, setFdvSort] = useState<SortState>('default');
  const [changeSort, setChangeSort] = useState<SortState>('default');

  const supportedSortFields = useMemo(
    () => new Set(sortFields || []),
    [sortFields],
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
  const [isInFirst100Items, setIsInFirst100Items] = useState(true);

  const handleVolumeSort = useCallback(() => {
    if (!supportedSortFields.has('volume_24h')) {
      return;
    }
    setVolumeSort(prev => toggleSort(prev));
    setFdvSort('default');
    setChangeSort('default');
  }, [supportedSortFields]);

  const handleFdvSort = useCallback(() => {
    if (!supportedSortFields.has('fdv')) {
      return;
    }
    setFdvSort(prev => toggleSort(prev));
    setVolumeSort('default');
    setChangeSort('default');
  }, [supportedSortFields]);

  const handleChangeSort = useCallback(() => {
    if (!supportedSortFields.has('price_change_24h')) {
      return;
    }
    setChangeSort(prev => toggleSort(prev));
    setVolumeSort('default');
    setFdvSort('default');
  }, [supportedSortFields]);

  const handleOpenTokenDetail = useCallback(
    (token: TokenMarketTokenItem) => {
      if (categoryId === 'meme') {
        matomoRequestEvent({
          category: 'Rabby Memecoin',
          action: 'Memecoin_ClickList',
        });
      }

      navigateDeprecated(RootNames.TokenMarketInfo, {
        token: memeItemToITokenItem(token, ''),
        unHold: false,
        needUseCacheToken: true,
        from:
          categoryId === 'meme'
            ? {
                scene: 'meme',
                id: token.id,
                chain: token.chain,
                symbol: token.symbol || '',
              }
            : undefined,
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
    if (!isFocused || !isInFirst100Items) {
      return;
    }

    const timer = setInterval(() => {
      refreshTokenListSilently();
    }, 10000);

    return () => {
      clearInterval(timer);
    };
  }, [isFocused, isInFirst100Items, refreshTokenListSilently]);

  return (
    <View style={styles.container}>
      {!!headerSpacerHeight && (
        <View style={[styles.header, { height: headerSpacerHeight }]} />
      )}
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
      />
      <FlatList
        data={list}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
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
    </View>
  );
}

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    paddingTop: 38,
    flex: 1,
  },
  header: {
    height: isAndroid ? 46 : 44,
  },
  scrollView: {
    paddingHorizontal: 12,
    flexGrow: 1,
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
