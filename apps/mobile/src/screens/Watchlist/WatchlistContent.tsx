import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  Platform,
  Pressable,
  RefreshControl,
  View,
  ViewToken,
} from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { Button } from '@/components2024/Button';
import { Text } from '@/components/Typography';
import { preferenceService } from '@/core/services';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  getBottomButtonBottomOffset,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  buildMarketTokenDetailFrom,
  getMarketTabClickListAction,
} from '@/screens/Market/analytics';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { tokenItemToITokenItem } from '@/utils/token';
import { useFocusEffect } from '@react-navigation/native';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { useFocusedTab } from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';

import { WatchlistCheckbox } from './components/Checkbox';
import { EmptyWatchlist } from './components/EmptyHolder';
import { useHotTokenList } from './hooks/useHotTokenList';
import { useWatchlistTokens } from './hooks/useWatchlistTokens';
import WatchListHeader from './components/TokenHeader';
import { TokenItemSkeleton, TokenListItem } from './components/TokenItem';
import {
  sortWatchlistTokens,
  watchlistChangeSortAtom,
  watchlistTokenSortAtom,
} from './sort';
import { matomoRequestEvent } from '@/utils/analytics';
import { marketRealtimePriceAtom } from '../Market/atom';
import { TAB_BAR_HEIGHT } from '../Market/constants';
import { setWatchlistTopCache } from './cache';

const isAndroid = Platform.OS === 'android';
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 0,
};
const STICKY_HEADER_INDICES = [0];

export function WatchlistContent({
  onVisibleUuidsChange,
  visibleUuidsTabId = 'watchlist',
}: {
  onVisibleUuidsChange?: (tabId: string, uuids: string[]) => void;
  visibleUuidsTabId?: string;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const setMarketRealtimePrice = useSetAtom(marketRealtimePriceAtom);
  const clearCurrentListRealtimePrice = useCallback(() => {
    setMarketRealtimePrice({});
  }, [setMarketRealtimePrice]);
  const {
    data: watchlistTokens,
    handleFetchTokens,
    hasData,
    loading: watchlistLoading,
  } = useWatchlistTokens(clearCurrentListRealtimePrice);

  const [tokenSort, setTokenSort] = useAtom(watchlistTokenSortAtom);
  const [changeSort, setChangeSort] = useAtom(watchlistChangeSortAtom);
  const [skip, setSkip] = useState(() => preferenceService.getWatchlistSkip());
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const focusedTab = useFocusedTab();

  const showGuide = useMemo(() => {
    return !skip && !hasData && !watchlistLoading && !watchlistTokens.length;
  }, [hasData, skip, watchlistLoading, watchlistTokens.length]);

  const centerEmpty = useMemo(() => {
    return !hasData && !showGuide;
  }, [hasData, showGuide]);

  const { hotTokenList, loading: hotTokenListLoading } =
    useHotTokenList(showGuide);

  useFocusEffect(
    useCallback(() => {
      if (focusedTab !== 'watchlist') {
        return;
      }
      handleFetchTokens();
    }, [focusedTab, handleFetchTokens]),
  );

  useEffect(() => {
    setSkip(preferenceService.getWatchlistSkip());
  }, []);

  useEffect(() => {
    if (hotTokenList.length > 0 && !hasInitialized) {
      const firstFiveIds = hotTokenList
        .slice(0, 5)
        .map(token => `${token.chain}:${token.id}`);
      setSelectedTokens(new Set(firstFiveIds));
      setHasInitialized(true);
    }
  }, [hotTokenList.length, hasInitialized, hotTokenList]);

  const handleTokenSelect = useCallback((tokenId: string) => {
    setSelectedTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenId)) {
        newSet.delete(tokenId);
      } else {
        newSet.add(tokenId);
      }
      return newSet;
    });
  }, []);

  const handleAddToWatchlist = useCallback(() => {
    const tokens = hotTokenList.filter(token =>
      selectedTokens.has(`${token.chain}:${token.id}`),
    );
    tokens.forEach(token => {
      preferenceService.pinToken({
        chainId: token.chain,
        tokenId: token.id,
      });
    });
    handleFetchTokens();
  }, [handleFetchTokens, hotTokenList, selectedTokens]);

  const list = useMemo(
    () => sortWatchlistTokens(watchlistTokens, tokenSort, changeSort),
    [watchlistTokens, tokenSort, changeSort],
  );

  useEffect(() => {
    setWatchlistTopCache(list);
  }, [list]);

  const handleOpenTokenDetail = useCallback(
    (token: TokenDetailWithPriceCurve) => {
      const clickAction = getMarketTabClickListAction('watchlist');

      if (clickAction) {
        matomoRequestEvent({
          category: 'Rabby Market',
          action: clickAction,
        });
      }
      navigateDeprecated(RootNames.TokenMarketInfo, {
        token: tokenItemToITokenItem(token, ''),
        unHold: false,
        needUseCacheToken: true,
        from: buildMarketTokenDetailFrom({
          categoryId: 'watchlist',
          id: token.id,
          chain: token.chain,
          symbol: token.symbol,
        }),
      });
    },
    [],
  );

  const handleTokenSort = useCallback(() => {
    clearCurrentListRealtimePrice();
    setTokenSort(prev => {
      if (prev === 'default') {
        return 'desc';
      }
      if (prev === 'desc') {
        return 'asc';
      }
      if (prev === 'asc') {
        return 'default';
      }
      return 'default';
    });
    setChangeSort('default');
    handleFetchTokens(true);
  }, [
    clearCurrentListRealtimePrice,
    handleFetchTokens,
    setChangeSort,
    setTokenSort,
  ]);

  const handleChangeSort = useCallback(() => {
    clearCurrentListRealtimePrice();
    setChangeSort(prev => {
      if (prev === 'default') {
        return 'desc';
      }
      if (prev === 'desc') {
        return 'asc';
      }
      if (prev === 'asc') {
        return 'default';
      }
      return 'default';
    });
    setTokenSort('default');
    handleFetchTokens(true);
  }, [
    clearCurrentListRealtimePrice,
    handleFetchTokens,
    setChangeSort,
    setTokenSort,
  ]);

  const renderItem = useCallback(
    ({ item, index }: { item: TokenDetailWithPriceCurve; index: number }) => (
      <TokenListItem
        item={item}
        onPress={handleOpenTokenDetail}
        style={index === 0 ? styles.firstItemPadding : undefined}
      />
    ),
    [handleOpenTokenDetail, styles.firstItemPadding],
  );

  const keyExtractor = useCallback(
    (item: TokenDetailWithPriceCurve) => item.id + '/' + item.chain,
    [],
  );

  const renderHeaderSpacer = useCallback(
    () => <View style={[styles.header]} />,
    [styles.header],
  );

  const renderGuideContent = useCallback(
    () => (
      <>
        {renderHeaderSpacer()}
        {hotTokenListLoading &&
          hotTokenList.length === 0 &&
          Array.from({ length: 8 }).map((_, idx) => (
            <TokenItemSkeleton key={idx} />
          ))}
        {!list.length && !watchlistLoading && (
          <EmptyWatchlist style={styles.topEmpty} />
        )}
        {hotTokenList.map(item => (
          <TokenListItem
            leftSlot={
              <WatchlistCheckbox
                checked={selectedTokens.has(`${item.chain}:${item.id}`)}
                onPress={() => handleTokenSelect(`${item.chain}:${item.id}`)}
              />
            }
            key={item.id}
            item={item}
            style={styles.tokenItem}
            onPress={() => handleTokenSelect(`${item.chain}:${item.id}`)}
          />
        ))}
        <View style={styles.bottomPadding} />
      </>
    ),
    [
      handleTokenSelect,
      hotTokenList,
      hotTokenListLoading,
      list.length,
      renderHeaderSpacer,
      selectedTokens,
      styles.bottomPadding,
      styles.topEmpty,
      watchlistLoading,
      styles.tokenItem,
    ],
  );

  const renderListHeader = useCallback(
    () => (
      <>
        {!!list.length && (
          <View style={styles.stickyHeader}>
            <WatchListHeader
              fdvSort={tokenSort}
              onFdvSort={handleTokenSort}
              changeSort={changeSort}
              onChangeSort={handleChangeSort}
              disableLeftSort
              showFdvSort
            />
          </View>
        )}
      </>
    ),
    [
      changeSort,
      handleChangeSort,
      handleTokenSort,
      list,
      styles.stickyHeader,
      tokenSort,
    ],
  );

  const renderListEmptyComponent = useCallback(() => {
    if (watchlistLoading) {
      return (
        <>
          {Array.from({ length: 8 }).map((_, idx) => (
            <TokenItemSkeleton key={idx} />
          ))}
        </>
      );
    }

    return (
      <EmptyWatchlist style={centerEmpty ? styles.centerEmpty : undefined} />
    );
  }, [centerEmpty, styles.centerEmpty, watchlistLoading]);

  const renderListFooter = useCallback(
    () => <View style={styles.bottomPadding} />,
    [styles.bottomPadding],
  );

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await handleFetchTokens(true);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [handleFetchTokens]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      onVisibleUuidsChange?.(
        visibleUuidsTabId,
        viewableItems
          .map(item => item.item)
          .filter(Boolean)
          .map(item => `${item.chain}:${item.id}`),
      );
    },
    [onVisibleUuidsChange, visibleUuidsTabId],
  );

  return (
    <>
      {showGuide ? (
        <Tabs.ScrollView
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          horizontal={false}
          nestedScrollEnabled={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}>
          {renderGuideContent()}
        </Tabs.ScrollView>
      ) : (
        <Tabs.FlatList
          data={list}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          ListHeaderComponent={renderListHeader}
          stickyHeaderIndices={STICKY_HEADER_INDICES}
          ListEmptyComponent={renderListEmptyComponent}
          ListFooterComponent={renderListFooter}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleManualRefresh}
            />
          }
        />
      )}
      {showGuide && (
        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              setSkip(true);
              preferenceService.setWatchlistSkip(true);
            }}>
            <Text style={styles.skipText}>
              {t('page.watchlist.footer.skip')}
            </Text>
          </Pressable>
          <Button
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            title={t('page.watchlist.footer.add', {
              count: selectedTokens.size,
            })}
            disabled={selectedTokens.size === 0}
            onPress={handleAddToWatchlist}
          />
        </View>
      )}
    </>
  );
}

const getStyle = createGetStyles2024(
  ({ isLight, colors2024, safeAreaInsets }) => ({
    container: {
      flex: 1,
    },
    header: {
      height: 8,
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      paddingHorizontal: 16,
      paddingTop: 0,
      marginTop: isAndroid ? TAB_BAR_HEIGHT : 0,
      flexGrow: 1,
    },
    stickyHeader: {
      paddingTop: 14,
      paddingBottom: 4,
      backgroundColor: colors2024['neutral-bg-1'],
    },
    centerEmpty: {
      marginTop: '50%',
    },
    footer: {
      backgroundColor: colors2024['neutral-bg-1'],
      paddingHorizontal: 20,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
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
      height: 160,
    },
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
    topEmpty: {
      marginTop: 26,
    },
    tokenItem: {
      paddingHorizontal: 12,
    },
    firstItemPadding: {
      paddingTop: 8,
    },
  }),
);
