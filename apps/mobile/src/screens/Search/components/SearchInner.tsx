import { useTheme2024 } from '@/hooks/theme';
import {
  Keyboard,
  Platform,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactIconHome } from '@/assets2024/icons/browser';
import { useDebounce, useMemoizedFn } from 'ahooks';
import { NextSearchBar } from '@/components2024/SearchBar';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createGetStyles2024 } from '@/utils/styles';
import { parse } from 'tldts';
import { useBrowser } from '@/hooks/browser/useBrowser';
import {
  BrowserSearchResult,
  DappFirstSearchResult,
} from '@/screens/Browser/BrowserScreen/components/BrowserSearch/BrowserSearchResult';
import { useSearchDapps } from '@/screens/Browser/BrowserScreen/hooks/useSearchDapps';
import { useShowSearchBottomSheet } from './SeachBottomSheet';
import { useSearchTokens } from '../useSearch';
import { IS_ANDROID } from '@/core/native/utils';
import { SearchAssetsOnHome } from './SearchAssetsOnHome';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

export const SearchInner = ({
  searchText,
  setSearchText,
}: {
  searchText: string;
  setSearchText: (p: string) => void;
}) => {
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const isTransparent = !searchText;

  const [, setShowSearchBottomSheet] = useShowSearchBottomSheet();
  const { openTab } = useBrowser();

  const onClose = useMemoizedFn(() => {
    setShowSearchBottomSheet(false);
  });

  const onOpenURL = useMemoizedFn(async url => {
    if (!url?.trim()) {
      return;
    }

    Keyboard.dismiss();
    await waitKeyboardHide();
    openTab(url);
    setShowSearchBottomSheet(false);
  });

  const { bottom } = useSafeAreaInsets();
  const isValidDomain = useMemo(() => {
    const pared = parse(searchText);
    return (
      !searchText.includes('@') &&
      searchText.includes('.') &&
      (pared.isIcann || pared.isIp)
    );
  }, [searchText]);

  const { list, loading: dappLoading } = useSearchDapps(searchText);
  const debouncedSearchValue = useDebounce(searchText, { wait: 500 });

  const {
    resultTokens,
    loading: tokenLoading,
    handleSearch,
  } = useSearchTokens(debouncedSearchValue);

  useEffect(() => {
    if (debouncedSearchValue) {
      handleSearch(debouncedSearchValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue]);

  const handleSubmitEditing = useMemoizedFn(() => {
    if (!searchText) {
      return;
    }
    if (isValidDomain) {
      onOpenURL?.(
        /^https?:\/\//.test(searchText) ? searchText : `https://${searchText}`,
      );
    }

    if (!searchText.trim()) {
      onClose();
    }
  });

  const handlePressHome = useMemoizedFn(() => {
    Keyboard.dismiss();
    onClose();
  });

  const waitKeyboardHide = useMemoizedFn(async () => {
    if (!Keyboard.isVisible()) {
      return;
    }
    return new Promise(resolve => {
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

  const handleClose = useMemoizedFn(async () => {
    Keyboard.dismiss();
    await waitKeyboardHide();
    onClose();
  });

  const handleBlur = useMemoizedFn(async () => {
    Keyboard.dismiss();
    await waitKeyboardHide();
  });

  const handleOpenUrl = useMemoizedFn(async (url: string) => {
    onOpenURL?.(url);
  });

  const Content = useMemo(() => {
    if (!searchText) {
      return <Pressable onPress={handleClose} style={{ flex: 1 }} />;
    }
    if (debouncedSearchValue !== searchText || tokenLoading || dappLoading) {
      return (
        <SearchAssetsOnHome
          resultTokens={[]}
          loading={true}
          searchState={searchText}
          stickyHeaderStyle={{
            width: 0,
            height: 0,
            overflow: 'hidden',
          }}
        />
      );
    }
    if (!tokenLoading && !dappLoading) {
      if (!list.length && !resultTokens.length) {
        return (
          <>
            <View style={{ height: 40 }} />
            <BrowserSearchResult
              key={searchText}
              isInBottomSheet
              searchText={searchText}
              data={list || []}
              isValidDomain={!!isValidDomain}
              onOpenURL={origin => {
                handleOpenUrl(origin);
              }}
            />
          </>
        );
      }
      if (list.length && resultTokens.length) {
        return (
          <>
            <SearchAssetsOnHome
              resultTokens={resultTokens}
              loading={tokenLoading}
              searchState={searchText}
              Header={
                <DappFirstSearchResult
                  searchText={searchText}
                  data={list || []}
                  isValidDomain={!!isValidDomain}
                  onOpenURL={origin => {
                    console.log('origin', origin);
                    handleOpenUrl(origin);
                  }}
                  style={styles.headerMarginTop}
                />
              }
              stickyHeaderStyle={[styles.stickyHeader, styles.headerMarginTop]}
              onTokenSelect={onClose}
            />
          </>
        );
      }

      if (!list.length && resultTokens.length) {
        return (
          <SearchAssetsOnHome
            resultTokens={resultTokens}
            loading={tokenLoading}
            searchState={searchText}
            onTokenSelect={onClose}
            stickyHeaderStyle={[styles.stickyHeader, styles.headerMarginTop]}
          />
        );
      }

      if (list.length && !resultTokens.length) {
        return (
          <BrowserSearchResult
            key={searchText}
            isInBottomSheet
            searchText={searchText}
            data={list || []}
            isValidDomain={!!isValidDomain}
            onOpenURL={origin => {
              console.log('origin', origin);
              handleOpenUrl(origin);
            }}
          />
        );
      }
    }
    return null;
  }, [
    searchText,
    debouncedSearchValue,
    tokenLoading,
    dappLoading,
    handleClose,
    list,
    resultTokens,
    isValidDomain,
    handleOpenUrl,
    styles.headerMarginTop,
    styles.stickyHeader,
    onClose,
  ]);

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { height: '100%' },
        isTransparent && { backgroundColor: 'transparent' },
      ]}>
      {Content}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handlePressHome}>
          <ReactIconHome
            width={44}
            height={44}
            color={colors2024['neutral-title-1']}
            backgroundColor={colors2024['neutral-bg-5']}
          />
        </TouchableOpacity>
        <NextSearchBar
          as="BottomSheetTextInput"
          value={searchText}
          onChangeText={setSearchText}
          onCancel={handleClose}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitEditing}
          enterKeyHint="done"
          autoFocus
          placeholder={
            IS_ANDROID
              ? t('page.search.globalSearch.placeHolder')
              : t('page.search.globalSearch.iosPlaceHolder')
          }
          alwaysShowCancel
          style={styles.searchBar}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    container: {
      paddingHorizontal: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
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
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingBottom: Platform.select({
        ios: 12,
        android: Math.max(safeAreaInsets.bottom, 12),
      }),
      // marginBottom: 30,
      // box-shadow: 0px -6px 40px 0px rgba(55, 56, 63, 0.12);
      // backdrop-filter: blur(14.5px);
    },
    searchBar: {
      flex: 1,
    },
    headerMarginTop: {
      marginTop: 30,
    },
    stickyHeader: {
      position: 'static',
    },
  }),
);
