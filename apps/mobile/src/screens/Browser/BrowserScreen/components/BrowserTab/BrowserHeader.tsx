import React, { useMemo, useRef, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { RcIconCloseCC } from '@/assets/icons/common';
import { RcIconGoogle } from '@/assets/icons/dapp';
import { useAccountSceneVisible } from '@/components/AccountSwitcher/hooks';
import { NextSearchBar } from '@/components2024/SearchBar';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { IS_IOS } from '@/core/native/utils';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';

export function BrowserHeader({
  url,
  isFocused,
  onFocusChange,
  onSearch,
}: {
  url?: string;
  isFocused?: boolean;
  onFocusChange?(isFocused: boolean): void;
  onSearch?(search: string): void;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const [searchText, setSearchText] = useState('');
  const navigation = useRabbyAppNavigation();
  const forScene = '@ActiveDappWebViewModal';
  const { finalSceneCurrentAccount, sceneCurrentAccount } = useSceneAccountInfo(
    {
      forScene,
    },
  );
  const { isVisible: isOpen, toggleSceneVisible } =
    useAccountSceneVisible(forScene);

  const handleClose = useMemoizedFn(() => {
    navigation.goBack();
  });

  const urlInfo = useMemo(() => urlUtils.canoicalizeDappUrl(url || ''), [url]);
  const inputRef = useRef<any>(null);

  if (isFocused) {
    return (
      <View style={styles.header}>
        <NextSearchBar
          style={styles.searchBar}
          inputStyle={styles.searchBarInput}
          placeholder={IS_IOS ? 'Search website' : 'Search Dapp'}
          value={searchText}
          searchIcon={<RcIconGoogle />}
          autoFocus
          alwaysShowCancel
          onChangeText={setSearchText}
          onFocus={() => {
            onFocusChange?.(true);
          }}
          onBlur={() => {
            onFocusChange?.(false);
            setTimeout(() => {
              setSearchText('');
            }, 50);
          }}
          onCancel={() => {
            inputRef.current.blur();
          }}
          ref={inputRef}
          onSubmitEditing={e => {
            onSearch?.(e.nativeEvent.text);
          }}
          enterKeyHint={'go'}
        />
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => {
          toggleSceneVisible(forScene, !isOpen);
        }}>
        {finalSceneCurrentAccount ? (
          <WalletIcon
            type={finalSceneCurrentAccount?.type}
            width={24}
            height={24}
            style={styles.walletIcon}
          />
        ) : null}
      </TouchableOpacity>
      <View style={styles.addressBar}>
        <TouchableWithoutFeedback onPress={() => onFocusChange?.(true)}>
          {url ? (
            <Text style={styles.addressBarText}>{urlInfo.fullDomain}</Text>
          ) : (
            <View style={styles.addressBarInner}>
              <RcIconGoogle />
              <Text style={styles.addressBarPlaceholder}>
                Search {IS_IOS ? 'Website' : 'Dapp'}
              </Text>
            </View>
          )}
        </TouchableWithoutFeedback>
      </View>
      <View>
        <TouchableOpacity onPress={handleClose}>
          <View style={styles.iconCloseCircle}>
            <RcIconCloseCC
              width={21}
              height={21}
              color={colors2024['neutral-title-1']}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 9,
    gap: 12,
    width: '100%',
    // borderBottomWidth: 1,
    // borderBottomColor: colors2024['neutral-line'],
  },
  walletIcon: { borderRadius: 6 },
  addressBar: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    height: 42,
  },
  addressBarInner: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  addressBarText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  addressBarPlaceholder: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  iconCloseCircle: {
    width: 32,
    height: 32,
    backgroundColor: colors2024['neutral-bg-2'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
  },
  searchBar: {
    flex: 1,
  },
  searchBarInput: {
    height: 42,
  },
}));
