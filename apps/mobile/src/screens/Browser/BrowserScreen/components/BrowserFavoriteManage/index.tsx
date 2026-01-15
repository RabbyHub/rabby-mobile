import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { atom } from 'jotai';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';
import { BrowserSearch } from '../BrowserSearch';
import { BrowserFavorite } from './BrowserFavorite';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { RcNextSearchCC } from '@/assets/icons/common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const activeTabAtom = atom('favorites');

export function BrowserFavoriteManage(): JSX.Element {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const { bottom } = useSafeAreaInsets();

  const [searchState, setSearchState] = useState({
    isShowSearch: false,
    searchText: '',
  });

  const { openTab, setPartialBrowserState, closeAllTabs } = useBrowser();
  const { removeAllBrowserHistory } = useBrowserHistory();

  const { t } = useTranslation();

  return (
    <View style={styles.page}>
      <View style={styles.favoritesList}>
        <BrowserFavorite
          isInBottomSheet
          onPress={dapp => {
            openTab(dapp.url || dapp.origin);
            setPartialBrowserState({
              isShowFavorite: false,
            });
          }}
        />
      </View>

      <TouchableOpacity
        style={[styles.fabContainer, { paddingBottom: bottom || 12 }]}
        onPress={() => {
          setSearchState({
            isShowSearch: true,
            searchText: '',
          });
        }}>
        <View style={styles.innerCircle}>
          <RcNextSearchCC
            width={20}
            height={20}
            style={styles.icon}
            color={colors2024['neutral-secondary']}
          />
          <Text style={styles.text}>
            {t('page.browser.BrowserSearchEntry.openWebsites')}
          </Text>
          <View style={{ width: 20 }} />
        </View>
      </TouchableOpacity>

      {searchState.isShowSearch ? (
        <BrowserSearch
          style={styles.browserSearch}
          searchText={searchState.searchText}
          setSearchText={v => {
            setSearchState(prev => {
              return {
                ...prev,
                searchText: v,
              };
            });
          }}
          onClose={shouldClose => {
            if (shouldClose) {
              setSearchState({
                isShowSearch: false,
                searchText: '',
              });
              setPartialBrowserState({
                isShowBrowser: false,
                isShowManage: false,
              });
            } else {
              setSearchState({
                isShowSearch: false,
                searchText: '',
              });
            }
          }}
          onOpenURL={url => {
            openTab(url, {
              isDapp: true,
            });
          }}
        />
      ) : null}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  page: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  favoritesList: {
    flex: 1,
  },

  fabContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    ...Platform.select({
      ios: {
        shadowColor: isLight ? 'rgba(55, 56, 63, 0.12)' : 'rgba(0, 0, 0, 0.4)',
        shadowOffset: { width: 0, height: isLight ? -6 : -27 },
        shadowOpacity: 1,
        shadowRadius: isLight ? 20 : 13,
      },
      android: {},
    }),
  },
  gradient: {
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-5'],
  },
  innerCircle: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    position: 'relative',
    paddingLeft: 12,
    paddingRight: 12,
  },
  icon: {},
  text: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    flex: 1,
    textAlign: 'center',
    color: colors2024['neutral-foot'],
  },
  navControlItem: {
    flexShrink: 0,
  },

  browserSearch: {
    paddingTop: 18,
  },
}));
