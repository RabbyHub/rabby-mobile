import { useBrowser } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { atom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatListProps,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BrowserFavorite } from './BrowserFavorite';
// import { TouchableOpacity } from 'react-native-gesture-handler';
import { RcNextSearchCC } from '@/assets/icons/common';
import { ReactIconHome } from '@/assets2024/icons/browser';
import { DappInfo } from '@/core/services/dappService';
import { NativeGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const activeTabAtom = atom('favorites');

export function BrowserFavoriteManage({
  isInBottomSheet,
  onPressHome,
  scrollableGesture,
  onScroll,
}: {
  isInBottomSheet?: boolean;
  onPressHome?(): void;
  scrollableGesture?: NativeGesture;
  onScroll?: FlatListProps<DappInfo>['onScroll'];
}): JSX.Element {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const { bottom } = useSafeAreaInsets();

  const { openTab, setPartialBrowserState } = useBrowser();

  const { t } = useTranslation();

  return (
    <View style={styles.page}>
      <View style={styles.favoritesList}>
        <BrowserFavorite
          scrollableGesture={scrollableGesture}
          onScroll={onScroll}
          isInBottomSheet={isInBottomSheet}
          onPress={dapp => {
            openTab(dapp.url || dapp.origin);
            setPartialBrowserState({
              isShowFavorite: false,
            });
          }}
        />
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom:
              Platform.OS === 'ios' ? bottom : Math.max(bottom, 12),
          },
        ]}>
        <TouchableOpacity onPress={onPressHome}>
          <ReactIconHome
            width={44}
            height={44}
            color={colors2024['neutral-title-1']}
            backgroundColor={colors2024['neutral-bg-5']}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fabContainer]}
          onPress={() => {
            setPartialBrowserState({
              isShowBrowser: true,
              isShowSearch: true,
              searchText: '',
              searchTabId: '',
              trigger: 'home',
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
              {t('page.browser.BrowserSearchEntry.searchWebsite')}
            </Text>
            <View style={{ width: 20 }} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  favoritesList: {
    flex: 1,
  },

  fabContainer: {
    flex: 1,
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

  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    paddingVertical: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
}));
