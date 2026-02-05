import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAtom } from 'jotai';
import {
  FlatList,
  View,
  RefreshControl,
  Platform,
  ViewToken,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { TokenItemSkeleton, TokenListItem } from './components/TokenItem';
import TokenHeader from './components/TokenHeader';
import { useIsFocused } from '@react-navigation/native';
import { navigateDeprecated } from '@/utils/navigation';
import { matomoRequestEvent } from '@/utils/analytics';
import { MemeItem } from '@rabby-wallet/rabby-api/dist/types';
import { RootNames } from '@/constant/layout';
import { useMemeTokenList } from './hooks/useMemeTokenList';
import { atomByMMKV } from '@/core/storage/mmkv';
import { memeItemToITokenItem } from '@/utils/token';

const isAndroid = Platform.OS === 'android';

const volumeSortAtom = atomByMMKV<'desc' | 'asc' | 'default'>(
  '@meme.volumeSort',
  'default',
);
const fdvSortAtom = atomByMMKV<'desc' | 'asc' | 'default'>(
  '@meme.fdvSort',
  'default',
);
const changeSortAtom = atomByMMKV<'desc' | 'asc' | 'default'>(
  '@meme.changeSort',
  'default',
);

function MemeScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });

  const [volumeSort, setVolumeSort] = useAtom(volumeSortAtom);
  const [fdvSort, setFdvSort] = useAtom(fdvSortAtom);
  const [changeSort, setChangeSort] = useAtom(changeSortAtom);

  const { orderBy, order } = useMemo(() => {
    if (volumeSort !== 'default') {
      return {
        orderBy: 'volume_24h' as const,
        order: volumeSort as 'desc' | 'asc',
      };
    }
    if (fdvSort !== 'default') {
      return {
        orderBy: 'fdv' as const,
        order: fdvSort as 'desc' | 'asc',
      };
    }
    if (changeSort !== 'default') {
      return {
        orderBy: 'price_change_24h' as const,
        order: changeSort as 'desc' | 'asc',
      };
    }
    return {
      orderBy: 'fdv' as const,
      order: 'desc' as const,
    };
  }, [volumeSort, fdvSort, changeSort]);

  const {
    memeTokenList: list,
    getMemeTokenList,
    loading: tokenListLoading,
    loadingMore,
    hasMore,
    loadMore,
    refreshMemeTokenListSilently,
  } = useMemeTokenList(orderBy, order);

  const isFocused = useIsFocused();
  const [isInFirst100Items, setIsInFirst100Items] = useState(true);

  const handleVolumeSort = useCallback(() => {
    setVolumeSort(prev => {
      const next =
        prev === 'default' ? 'desc' : prev === 'desc' ? 'asc' : 'default';
      if (next !== 'default') {
        getMemeTokenList(true, 'volume_24h', next);
      } else {
        getMemeTokenList(true, 'fdv', 'desc');
      }
      return next;
    });
    setFdvSort('default');
    setChangeSort('default');
  }, [getMemeTokenList, setVolumeSort, setFdvSort, setChangeSort]);

  const handleFdvSort = useCallback(() => {
    setFdvSort(prev => {
      const next =
        prev === 'default' ? 'desc' : prev === 'desc' ? 'asc' : 'default';
      if (next !== 'default') {
        getMemeTokenList(true, 'fdv', next);
      } else {
        getMemeTokenList(true, 'fdv', 'desc');
      }
      return next;
    });
    setVolumeSort('default');
    setChangeSort('default');
  }, [getMemeTokenList, setFdvSort, setVolumeSort, setChangeSort]);

  const handleOpenTokenDetail = useCallback((token: MemeItem) => {
    matomoRequestEvent({
      category: 'Rabby Memecoin',
      action: 'Memecoin_ClickList',
    });
    navigateDeprecated(RootNames.TokenMarketInfo, {
      // TODO: 可能不需要转化
      token: memeItemToITokenItem(token, ''),
      unHold: false,
      needUseCacheToken: true,
      from: 'meme',
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MemeItem }) => (
      <TokenListItem item={item} onPress={handleOpenTokenDetail} />
    ),
    [handleOpenTokenDetail],
  );

  const keyExtractor = useCallback((item: MemeItem) => item.id, []);

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
  }, [tokenListLoading, list.length]);

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
  }, [hasMore, loadingMore, tokenListLoading, loadMore]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const firstItem = viewableItems[0];
        const firstVisibleIndex = firstItem?.index;
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

  const handleChangeSort = useCallback(() => {
    setChangeSort(prev => {
      const next =
        prev === 'default' ? 'desc' : prev === 'desc' ? 'asc' : 'default';
      if (next !== 'default') {
        getMemeTokenList(true, 'price_change_24h', next);
      } else {
        getMemeTokenList(true, 'fdv', 'desc');
      }
      return next;
    });
    setVolumeSort('default');
    setFdvSort('default');
  }, [getMemeTokenList, setChangeSort, setVolumeSort, setFdvSort]);

  // 当前页面 focus 且滚动位置在前100项时，每 5 秒静默刷新一次列表
  useEffect(() => {
    if (!isFocused || !isInFirst100Items) {
      return;
    }

    const timer = setInterval(() => {
      refreshMemeTokenListSilently();
      // 这个值根据币价更新时间来调整，目前币价是十几秒更新一次
    }, 10000);

    return () => {
      clearInterval(timer);
    };
  }, [isFocused, isInFirst100Items, refreshMemeTokenListSilently]);

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      noHeader
      overwriteStyle={styles.overwriteStyle}>
      <View style={styles.header} />

      <TokenHeader
        volumeSort={volumeSort}
        onVolumeSort={handleVolumeSort}
        fdvSort={fdvSort}
        onFdvSort={handleFdvSort}
        changeSort={changeSort}
        onChangeSort={handleChangeSort}
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
            onRefresh={() => getMemeTokenList(true, orderBy, order)}
          />
        }
      />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  overwriteStyle: {
    position: 'relative',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  header: {
    height: isAndroid ? 46 : 44,
  },
  scrollView: {
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  centerEmpty: {
    marginTop: '50%',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  skipText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    paddingBottom: 17,
    paddingTop: 14,
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

export default MemeScreen;
