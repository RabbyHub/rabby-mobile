import { useTheme2024 } from '@/hooks/theme';
import { Keyboard, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactIconHome } from '@/assets2024/icons/browser';
import { useDebounce, useMemoizedFn } from 'ahooks';
import { NextSearchBar } from '@/components2024/SearchBar';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { SearchAssets } from './SearchAssets';

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
    // if (!searchText.trim() && !displayedBrowserHistoryList.length) {
    await waitKeyboardHide();
    onClose?.();
    // }
  });

  const handleOpenUrl = useMemoizedFn(async (url: string) => {
    onOpenURL?.(url);
  });

  const Content = useMemo(() => {
    if (!searchText) {
      return null;
    }
    if (debouncedSearchValue !== searchText || tokenLoading || dappLoading) {
      return (
        <SearchAssets
          resultTokens={[]}
          loading={true}
          searchState={searchText}
          inGlobalSearch
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
        );
      }
      if (list.length && resultTokens.length) {
        return (
          <>
            <SearchAssets
              resultTokens={resultTokens}
              loading={tokenLoading}
              searchState={searchText}
              inGlobalSearch
              Header={
                <DappFirstSearchResult
                  // key={""}
                  // isInBottomSheet
                  searchText={searchText}
                  data={list || []}
                  isValidDomain={!!isValidDomain}
                  onOpenURL={origin => {
                    console.log('origin', origin);
                    handleOpenUrl(origin);
                  }}
                  // showOtherResults={false}
                />
              }
              stickyHeaderStyle={styles.stickyHeader}
              onTokenSelect={onClose}
            />
          </>
        );
      }

      if (!list.length && resultTokens.length) {
        return (
          <SearchAssets
            resultTokens={resultTokens}
            loading={tokenLoading}
            searchState={searchText}
            inGlobalSearch
            onTokenSelect={onClose}
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
    onClose,
    debouncedSearchValue,
    searchText,
    tokenLoading,
    dappLoading,
    list,
    resultTokens,
    isValidDomain,
    styles.stickyHeader,
    handleOpenUrl,
  ]);

  return (
    <View
      style={[
        styles.container,
        { height: '100%' },
        isTransparent && { backgroundColor: 'transparent' },
      ]}>
      {Content}

      <View
        style={[
          styles.footer,
          {
            position: 'absolute',
            // right: 0,
            // bottom: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // marginTop: 'auto',
            // paddingBottom: isVisible ? 12 : bottom || 12,
            // marginBottom:
            //   Platform.OS === 'android' ? androidOnlyBottomOffset : 20,
          },
        ]}>
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
          placeholder={t('page.search.globalSearch.placeHolder')}
          alwaysShowCancel
          style={styles.searchBar}
        />
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    // flex: 1,uni
    paddingTop: 40,
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
    // marginBottom: 30,
    // box-shadow: 0px -6px 40px 0px rgba(55, 56, 63, 0.12);
    // backdrop-filter: blur(14.5px);
  },
  searchBar: {
    flex: 1,
  },
  stickyHeader: {
    position: 'static',
  },
}));
