import React, { useMemo, useRef, useTransition } from 'react';
import { Keyboard, StyleProp, View, ViewStyle } from 'react-native';

import { NextSearchBar } from '@/components2024/SearchBar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useSearchDapps } from '../../hooks/useSearchDapps';
import { BrowserRecent } from './BrowserRecent';
import { BrowserSearchResult } from './BrowserSearchResult';
import { parse } from 'tldts';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTranslation } from 'react-i18next';
import { TouchableWithoutFeedback } from '@gorhom/bottom-sheet';

export function BrowserSearch({
  onClose,
  onOpenURL,
  searchText,
  setSearchText,
  trigger,
  style,
}: {
  onClose?(shouldClosePopup?: boolean): void;
  onOpenURL?(url: string): void;
  searchText: string;
  setSearchText?(v: string): void;
  trigger?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();
  const { list } = useSearchDapps(searchText);

  const { browserHistoryList } = useBrowserHistory();

  const displayedBrowserHistoryList = useMemo(() => {
    return browserHistoryList.slice(0, 3);
  }, [browserHistoryList]);

  const isValidDomain = useMemo(() => {
    const pared = parse(searchText);
    return !searchText.includes('@') && (pared.isIcann || pared.isIp);
  }, [searchText]);

  const isTransparent =
    trigger === 'home' && !displayedBrowserHistoryList.length && !searchText;

  const isOpenURLRef = useRef(false);

  return (
    <View
      style={[
        styles.container,

        style,

        isTransparent
          ? {
              backgroundColor: 'transparent',
            }
          : null,
      ]}>
      {!searchText?.trim() ? (
        trigger === 'home' && !displayedBrowserHistoryList.length ? (
          <View style={{ flex: 1 }}>
            <TouchableWithoutFeedback
              onPress={() => {
                Keyboard.dismiss();
              }}>
              <View style={{ height: '100%' }} />
            </TouchableWithoutFeedback>
          </View>
        ) : (
          <BrowserRecent
            isInBottomSheet
            list={displayedBrowserHistoryList}
            onPress={dapp => {
              Keyboard.dismiss();
              isOpenURLRef.current = true;
              setTimeout(() => {
                onOpenURL?.(dapp.url || dapp.origin);
              }, 200);
            }}
          />
        )
      ) : (
        <BrowserSearchResult
          isInBottomSheet
          searchText={searchText}
          data={list || []}
          isValidDomain={!!isValidDomain}
          onOpenURL={url => {
            Keyboard.dismiss();
            isOpenURLRef.current = true;
            setTimeout(() => {
              onOpenURL?.(url);
            }, 200);
          }}
        />
      )}

      <View style={styles.footer}>
        <NextSearchBar
          as="BottomSheetTextInput"
          value={searchText}
          onChangeText={setSearchText}
          onCancel={() => {
            Keyboard.dismiss();
            setTimeout(() => {
              // onClose?.(isTransparent && !searchText);
              onClose?.(trigger === 'home' && !isOpenURLRef.current);
            }, 200);
          }}
          onBlur={() => {
            Keyboard.dismiss();
            setTimeout(() => {
              // onClose?.(isTransparent && !searchText);
              onClose?.(trigger === 'home' && !isOpenURLRef.current);
            }, 200);
          }}
          onSubmitEditing={() => {
            if (!searchText) {
              return;
            }
            if (isValidDomain) {
              onOpenURL?.(
                /^https?:\/\//.test(searchText)
                  ? searchText
                  : `https://${searchText}`,
              );
            } else {
              onOpenURL?.(
                `https://www.google.com/search?q=${encodeURIComponent(
                  searchText,
                )}`,
              );
            }
            isOpenURLRef.current = true;
          }}
          enterKeyHint="go"
          autoFocus
          placeholder={t('page.browser.BrowserSearch.placeholder')}
        />
      </View>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    display: 'flex',
    flexDirection: 'column',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 38,
  },
  list: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemContent: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listItemIcon: {
    width: 20,
    height: 20,
  },
  listItemArrowIcon: {
    width: 16,
    height: 16,
  },
  listItemText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    paddingVertical: 12,
    // marginBottom: 30,
    // box-shadow: 0px -6px 40px 0px rgba(55, 56, 63, 0.12);
    // backdrop-filter: blur(14.5px);
  },
}));
