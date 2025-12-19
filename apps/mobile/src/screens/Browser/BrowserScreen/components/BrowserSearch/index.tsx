import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { ReactIconHome } from '@/assets2024/icons/browser';
import { NextSearchBar } from '@/components2024/SearchBar';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { matomoRequestEvent } from '@/utils/analytics';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  TouchableWithoutFeedback,
} from '@gorhom/bottom-sheet';
import { useAppState } from '@react-native-community/hooks';
import { useMemoizedFn } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { parse } from 'tldts';
import { useSearchDapps } from '../../hooks/useSearchDapps';
import { BrowserRecent } from './BrowserRecent';
import { BrowserSearchResult } from './BrowserSearchResult';

import {
  AndroidSoftInputModes,
  KeyboardController,
} from 'react-native-keyboard-controller';
import { BrowserHot } from './BrowserHot';
import { BrowserFavorite } from './BrowserFavorite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalPannableDraggableView } from '@/components/customized/BottomSheetDraggableView';

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
  // const { androidOnlyBottomOffset } = useSafeSizes();
  const { bottom } = useSafeAreaInsets();
  const [isFocused, setIsFocused] = useState(false);

  const { t } = useTranslation();
  const { list } = useSearchDapps(searchText);

  const { browserHistoryList } = useBrowserHistory();

  const isValidDomain = useMemo(() => {
    const pared = parse(searchText);
    return (
      !searchText.includes('@') &&
      searchText.includes('.') &&
      (pared.isIcann || pared.isIp)
    );
  }, [searchText]);

  const isTransparent =
    trigger === 'home' && !browserHistoryList.length && !searchText;

  const isOpenURLRef = useRef(false);

  const handleCancel = useMemoizedFn(async () => {
    Keyboard.dismiss();
    await waitKeyboardHide();
    onClose?.(trigger === 'home' && !isOpenURLRef.current);
  });

  const handleBlur = useMemoizedFn(async () => {
    Keyboard.dismiss();
    setIsFocused(false);
    if (!searchText.trim() && !browserHistoryList.length) {
      await waitKeyboardHide();
      onClose?.(trigger === 'home' && !isOpenURLRef.current);
    }
  });

  const waitKeyboardHide = useMemoizedFn(async () => {
    if (!Keyboard.isVisible()) {
      return;
    }
    return new Promise((resolve, reject) => {
      const keyboardHideListener =
        Platform.OS === 'android'
          ? Keyboard.addListener('keyboardDidHide', () => {
              setTimeout(() => {
                resolve(true);
              }, 60);
              keyboardHideListener.remove();
            })
          : Keyboard.addListener('keyboardWillHide', () => {
              setTimeout(() => {
                resolve(true);
              }, 350);
              keyboardHideListener.remove();
            });
    });
  });

  const handleOpenUrl = useMemoizedFn(async (url: string) => {
    isOpenURLRef.current = true;
    Keyboard.dismiss();
    await waitKeyboardHide();
    onOpenURL?.(url);
  });

  const handleSubmitEditing = useMemoizedFn(() => {
    if (!searchText) {
      return;
    }
    isOpenURLRef.current = true;
    if (isValidDomain) {
      onOpenURL?.(
        /^https?:\/\//.test(searchText) ? searchText : `https://${searchText}`,
      );
    }
    // else {
    //   onOpenURL?.(
    //     `https://www.google.com/search?q=${encodeURIComponent(searchText)}`,
    //   );
    // }
    if (!searchText.trim()) {
      onClose?.(trigger === 'home');
    }
  });

  const handlePressHome = useMemoizedFn(() => {
    Keyboard.dismiss();
    onClose?.(true);
    matomoRequestEvent({
      category: 'Websites Usage',
      action: `Website_Exit`,
      label: 'Click Home',
    });
  });

  const [key, setKey] = useState(0);

  const appState = useAppState();

  useEffect(() => {
    if (appState === 'active') {
      setKey(prev => prev + 1);
    }
  }, [appState]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      return;
    }
    KeyboardController.setInputMode(
      AndroidSoftInputModes.SOFT_INPUT_ADJUST_RESIZE,
    );

    return () => KeyboardController.setDefaultMode();
  }, []);

  return (
    <View
      style={[
        styles.container,
        style,
        isTransparent ? styles.transparent : null,
      ]}>
      <LocalPannableDraggableView>
        {!searchText?.trim() ? (
          <BottomSheetScrollView
            contentContainerStyle={{
              gap: 24,
              paddingHorizontal: 20,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {isTransparent ? null : (
              <>
                <BrowserRecent
                  isInBottomSheet
                  list={browserHistoryList}
                  onPress={dapp => {
                    handleOpenUrl(dapp.url || dapp.origin);
                    if (dapp.origin) {
                      matomoRequestEvent({
                        category: 'Websites Usage',
                        action: 'Website_Visit_Recent List',
                        label: dapp.origin,
                      });
                    }
                  }}
                />
              </>
            )}
            <View style={{ height: 100 }} />
          </BottomSheetScrollView>
        ) : (
          <BrowserSearchResult
            key={key}
            isInBottomSheet
            searchText={searchText}
            data={list || []}
            isValidDomain={!!isValidDomain}
            onOpenURL={origin => {
              handleOpenUrl(origin);
            }}
          />
        )}
      </LocalPannableDraggableView>

      <View
        style={[
          styles.footer,
          {
            position: 'absolute',
            right: 0,
            bottom: 0,
            marginTop: 'auto',
            paddingBottom: bottom || 12,
            // marginBottom:
            //   Platform.OS === 'android' ? androidOnlyBottomOffset : 20,
          },
        ]}>
        {/* <TouchableOpacity onPress={handlePressHome}>
          <ReactIconHome
            width={44}
            height={44}
            color={colors2024['neutral-title-1']}
            backgroundColor={colors2024['neutral-bg-5']}
          />
        </TouchableOpacity> */}
        <NextSearchBar
          as="BottomSheetTextInput"
          value={searchText}
          onChangeText={setSearchText}
          onCancel={handleCancel}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitEditing}
          enterKeyHint="done"
          autoFocus
          placeholder={t('page.browser.BrowserSearch.placeholder')}
          alwaysShowCancel
          style={styles.searchBar}
          onFocus={() => {
            setIsFocused(true);
          }}
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
    // marginBottom: 20,
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
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // marginBottom: 30,
    // box-shadow: 0px -6px 40px 0px rgba(55, 56, 63, 0.12);
    // backdrop-filter: blur(14.5px);
  },
  searchBar: {
    flex: 1,
  },

  transparent: {
    backgroundColor: 'transparent',
  },
}));
