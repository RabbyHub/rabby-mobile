import React, { useMemo } from 'react';
import { Keyboard, View } from 'react-native';

import { NextSearchBar } from '@/components2024/SearchBar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useSearchDapps } from '../../hooks/useSearchDapps';
import { BrowserRecent } from './BrowserRecent';
import { BrowserSearchResult } from './BrowserSearchResult';
import { parse } from 'tldts';

export function BrowserSearch({
  onClose,
  onOpenURL,
  searchText,
  setSearchText,
}: {
  onClose?(): void;
  onOpenURL?(url: string): void;
  searchText: string;
  setSearchText?(v: string): void;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const { list } = useSearchDapps(searchText);

  const isValidDomain = useMemo(() => {
    const pared = parse(searchText);
    return !searchText.includes('@') && (pared.isIcann || pared.isIp);
  }, [searchText]);

  return (
    <View style={styles.container}>
      {!searchText?.trim() ? (
        <BrowserRecent
          isInBottomSheet
          onPress={dapp => {
            Keyboard.dismiss();
            setTimeout(() => {
              onOpenURL?.(dapp.url || dapp.origin);
            }, 60);
          }}
        />
      ) : (
        <BrowserSearchResult
          isInBottomSheet
          searchText={searchText}
          data={list || []}
          isValidDomain={!!isValidDomain}
          onOpenURL={url => {
            Keyboard.dismiss();
            setTimeout(() => {
              onOpenURL?.(url);
            }, 60);
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
              onClose?.();
            }, 60);
          }}
          onBlur={() => {
            Keyboard.dismiss();
            setTimeout(() => {
              onClose?.();
            }, 60);
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
          }}
          enterKeyHint="go"
          autoFocus
          placeholder="Search Websites"
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
