import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  RefreshControl,
  Platform,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import SearchEntry from './components/SearchEntry';
import { EmptyWatchlist } from './components/EmptyHolder';
import { TokenItemSkeleton, TokenListItem } from './components/TokenItem';
import TokenHeader from './components/TokenHeader';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { preferenceService } from '@/core/services';
import { useWatchlistTokens } from './hooks/useWatchlistTokens';
import { navigateDeprecated } from '@/utils/navigation';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { RootNames } from '@/constant/layout';
import { useHotTokenList } from './hooks/useHotTokenList';
import { WatchlistCheckbox } from './components/Checkbox';
import { atomByMMKV } from '@/core/storage/mmkv';
import { tokenItemToITokenItem } from '@/utils/token';

const isAndroid = Platform.OS === 'android';

const tokenSortAtom = atomByMMKV<'desc' | 'asc' | 'default'>(
  '@watchlist.tokenSort',
  'default',
);
const changeSortAtom = atomByMMKV<'desc' | 'asc' | 'default'>(
  '@watchlist.changeSort',
  'default',
);

function WatchlistScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const {
    data: watchlistTokens,
    handleFetchTokens,
    hasData,
    loading: watchlistLoading,
  } = useWatchlistTokens();

  const [tokenSort, setTokenSort] = useAtom(tokenSortAtom);
  const [changeSort, setChangeSort] = useAtom(changeSortAtom);
  const [skip, setSkip] = useState(() => preferenceService.getWatchlistSkip());
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);

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
      handleFetchTokens();
    }, [handleFetchTokens]),
  );

  useEffect(() => {
    setSkip(preferenceService.getWatchlistSkip());
  }, []);

  // 当 hotTokenList 数据变化时，自动选中前五个（仅第一次）
  useEffect(() => {
    if (hotTokenList.length > 0 && !hasInitialized) {
      const firstFiveIds = hotTokenList
        .slice(0, 5)
        .map(token => `${token.chain}:${token.id}`);
      setSelectedTokens(new Set(firstFiveIds));
      setHasInitialized(true);
    }
  }, [hotTokenList.length, hasInitialized, hotTokenList]);

  // 处理选中/取消选中
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

  const list = useMemo(() => {
    return [...watchlistTokens].sort((a, b) => {
      if (tokenSort !== 'default') {
        if (tokenSort === 'asc') {
          return (a.identity?.fdv ?? 0) - (b.identity?.fdv ?? 0);
        }
        return (b.identity?.fdv ?? 0) - (a.identity?.fdv ?? 0);
      }
      if (changeSort !== 'default') {
        if (changeSort === 'asc') {
          return (a.price_24h_change ?? 0) - (b.price_24h_change ?? 0);
        }
        return (b.price_24h_change ?? 0) - (a.price_24h_change ?? 0);
      }
      return 0;
    });
  }, [watchlistTokens, tokenSort, changeSort]);

  const handleOpenTokenDetail = useCallback(
    (token: TokenDetailWithPriceCurve) => {
      navigateDeprecated(RootNames.TokenMarketInfo, {
        token: tokenItemToITokenItem(token, ''),
        unHold: false,
        needUseCacheToken: true,
      });
    },
    [],
  );

  const handleTokenSort = () => {
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
  };

  const handleChangeSort = () => {
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
  };

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      noHeader
      overwriteStyle={styles.overwriteStyle}>
      <View style={styles.header} />
      {!list.length && !watchlistLoading && (
        <EmptyWatchlist style={centerEmpty ? styles.centerEmpty : undefined} />
      )}
      {showGuide ? (
        <>
          <ScrollView
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}>
            {hotTokenListLoading &&
              hotTokenList.length === 0 &&
              Array.from({ length: 8 }).map((_, idx) => (
                <TokenItemSkeleton key={idx} />
              ))}
            {hotTokenList.map(item => (
              <TokenListItem
                leftSlot={
                  <WatchlistCheckbox
                    checked={selectedTokens.has(`${item.chain}:${item.id}`)}
                    onPress={() =>
                      handleTokenSelect(`${item.chain}:${item.id}`)
                    }
                  />
                }
                key={item.id}
                item={item}
                onPress={() => handleTokenSelect(`${item.chain}:${item.id}`)}
              />
            ))}
          </ScrollView>
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
              title={t('page.watchlist.footer.add', {
                count: selectedTokens.size,
              })}
              disabled={selectedTokens.size === 0}
              onPress={handleAddToWatchlist}
            />
          </View>
        </>
      ) : (
        <>
          {!!list.length && (
            <>
              <TokenHeader
                tokenSort={tokenSort}
                onTokenSort={handleTokenSort}
                changeSort={changeSort}
                onChangeSort={handleChangeSort}
              />
              <ScrollView
                style={styles.scrollView}
                refreshControl={
                  <RefreshControl
                    refreshing={watchlistLoading && list.length !== 0}
                    onRefresh={() => handleFetchTokens(true)}
                  />
                }>
                {watchlistLoading &&
                  list.length === 0 &&
                  Array.from({ length: 8 }).map((_, idx) => (
                    <TokenItemSkeleton key={idx} />
                  ))}
                {list.map(item => (
                  <TokenListItem
                    key={item.id}
                    item={item}
                    onPress={handleOpenTokenDetail}
                  />
                ))}
                <View style={styles.bottomPadding} />
              </ScrollView>
            </>
          )}
          <SearchEntry />
        </>
      )}
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
    flex: 1,
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

export default WatchlistScreen;
