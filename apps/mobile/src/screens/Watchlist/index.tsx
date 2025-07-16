import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import SearchEntry from './SearchEntry';
import { EmptyWatchlist } from './EmptyHolder';
import { TokenListItem } from './TokenItem';
import TokenHeader, { SortState } from './TokenHeader';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { preferenceService } from '@/core/services';
import { useWatchlistTokens } from './usePinTokens';

function WatchlistScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const {
    data: watchlistTokens,
    handleFetchTokens,
    hasData,
    loading: watchlistLoading,
  } = useWatchlistTokens();

  const [tokenSort, setTokenSort] = useState<SortState>('default');
  const [changeSort, setChangeSort] = useState<SortState>('default');
  const [skip, setSkip] = useState(() => preferenceService.getWatchlistSkip());

  const showGuide = useMemo(() => {
    return !skip && !hasData;
  }, [hasData, skip]);

  const centerEmpty = useMemo(() => {
    return !hasData && !showGuide;
  }, [hasData, showGuide]);

  useFocusEffect(
    useCallback(() => {
      handleFetchTokens();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useEffect(() => {
    setSkip(preferenceService.getWatchlistSkip());
  }, []);

  const list = useMemo(() => {
    return watchlistTokens.sort((a, b) => {
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
      return (b.identity?.fdv ?? 0) - (a.identity?.fdv ?? 0);
    });
  }, [watchlistTokens, tokenSort, changeSort]);

  return (
    <NormalScreenContainer2024
      type="bg0"
      overwriteStyle={styles.overwriteStyle}>
      {!hasData && (
        <EmptyWatchlist style={centerEmpty ? styles.centerEmpty : undefined} />
      )}
      {showGuide ? (
        <>
          <TokenHeader
            tokenSort={tokenSort}
            onTokenSort={() => {
              setTokenSort(tokenSort === 'asc' ? 'desc' : 'asc');
              setChangeSort('default');
            }}
            changeSort={changeSort}
            onChangeSort={() => {
              setChangeSort(changeSort === 'asc' ? 'desc' : 'asc');
              setTokenSort('default');
            }}
          />
          <ScrollView style={styles.scrollView}>
            {list.map(item => (
              <TokenListItem key={item.id} item={item} onPress={() => {}} />
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                preferenceService.setWatchlistSkip(true);
                setSkip(true);
              }}>
              <Text style={styles.skipText}>
                {t('page.watchlist.footer.skip')}
              </Text>
            </Pressable>
            <Button
              title={t('page.watchlist.footer.add', { count: list.length })}
              onPress={() => {}}
            />
          </View>
        </>
      ) : (
        <>
          {hasData && (
            <>
              <TokenHeader
                tokenSort={tokenSort}
                onTokenSort={() => {
                  setTokenSort(tokenSort === 'asc' ? 'desc' : 'asc');
                  setChangeSort('default');
                }}
                changeSort={changeSort}
                onChangeSort={() => {
                  setChangeSort(changeSort === 'asc' ? 'desc' : 'asc');
                  setTokenSort('default');
                }}
              />
              <ScrollView style={styles.scrollView}>
                {list.map(item => (
                  <TokenListItem key={item.id} item={item} onPress={() => {}} />
                ))}
              </ScrollView>
            </>
          )}
          <SearchEntry />
        </>
      )}
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  overwriteStyle: {
    paddingTop: 0,
    position: 'relative',
  },
  scrollView: {
    paddingHorizontal: 12,
    flex: 1,
  },
  centerEmpty: {
    marginTop: '50%',
  },
  footer: {
    paddingHorizontal: 12,
    paddingBottom: 48,
  },
  skipText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    paddingBottom: 14,
    paddingTop: 6,
  },
}));

export default WatchlistScreen;
