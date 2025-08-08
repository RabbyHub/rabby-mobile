import React, { useEffect, useRef } from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RcNextLeftCC } from '@/assets/icons/common';
import { NextSearchBar } from '@/components2024/SearchBar';

import { SearchAssets } from './components/SearchAssets';
import { useSearch, useSearchTokens } from './useSearch';
import { useTranslation } from 'react-i18next';
import LinearGradient, {
  LinearGradientProps,
} from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebounce } from 'ahooks';

function SearchScreen(): JSX.Element {
  const { navigation } = useSafeSetNavigationOptions();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { searchState, setSearchState } = useSearch();
  const debouncedSearchValue = useDebounce(searchState, { wait: 600 });

  const { t } = useTranslation();

  const inputRef = useRef<any>(null);

  const insets = useSafeAreaInsets();

  const linearGradientHeaderProps = React.useMemo(
    () => ({
      start: { x: 0.5, y: 0.64 },
      end: { x: 0.5, y: 1 },
      colors: isLight
        ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-0']]
        : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']],
      styles: {
        position: 'absolute',
        top: -insets.top,
        left: 0,
        right: 0,
        bottom: 0,
      } as LinearGradientProps['style'],
    }),
    [colors2024, insets.top, isLight],
  );

  const { resultTokens, searched, loading, handleSearch } =
    useSearchTokens(searchState);

  useEffect(() => {
    if (debouncedSearchValue) {
      handleSearch(debouncedSearchValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue]);

  return (
    <NormalScreenContainer2024
      noHeader
      overwriteStyle={styles.rootScreenContainer}>
      <View style={styles.header}>
        <LinearGradient
          start={linearGradientHeaderProps.start}
          end={linearGradientHeaderProps.end}
          colors={linearGradientHeaderProps.colors}
          style={linearGradientHeaderProps.styles}
        />
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
            setSearchState('');
            Keyboard.dismiss();
          }}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} />
        </TouchableOpacity>
        <NextSearchBar
          noCancel={true}
          style={styles.searchBar}
          placeholder={t('page.search.header.searchPlaceHolder')}
          value={searchState}
          autoFocus
          onChangeText={v => {
            setSearchState(v);
          }}
          returnKeyType="search"
          onSubmitEditing={() => {
            handleSearch(searchState);
          }}
          ref={inputRef}
        />
      </View>
      <View style={styles.safeView}>
        {(searched || loading) && (
          <SearchAssets
            resultTokens={searchState ? resultTokens : []}
            loading={loading}
            searchState={searchState}
          />
        )}
      </View>
    </NormalScreenContainer2024>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  rootScreenContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  safeView: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  searchBar: {
    flex: 1,
  },
}));

export default SearchScreen;
