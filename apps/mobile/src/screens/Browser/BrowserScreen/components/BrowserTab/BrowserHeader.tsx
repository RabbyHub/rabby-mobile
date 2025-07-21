import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Image,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { RcIconCloseCC } from '@/assets/icons/common';
import { RcIconDisconnectCC, RcIconGoogle } from '@/assets/icons/dapp';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import { NextSearchBar } from '@/components2024/SearchBar';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { IS_IOS } from '@/core/native/utils';
import { dappService, preferenceService } from '@/core/services';
import { DappInfo } from '@/core/services/dappService';
import { useMyAccounts } from '@/hooks/account';
// import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { getAddressBarTitle, isGoogle } from '@/utils/browser';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { CurrentDappPopup } from './CurrentDappPopup';
import { useFocusEffect } from '@react-navigation/native';

export function BrowserHeader({
  dapp,
  url,
  isFocused,
  onFocusChange,
  onSearch,
  searchText,
  onSearchTextChange,
}: {
  dapp?: DappInfo;
  url?: string;
  isFocused?: boolean;
  onFocusChange?(isFocused: boolean): void;
  onSearch?(search: string): void;
  searchText?: string;
  onSearchTextChange?(v: string): void;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

  // const navigation = useRabbyAppNavigation();

  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });

  const account = useMemo(() => {
    return (
      dapp?.currentAccount ||
      accounts?.[0] ||
      preferenceService.getFallbackAccount()
    );
  }, [accounts, dapp?.currentAccount]);

  const [isShowAccountPopup, setIsShowAccountPopup] = useState(false);
  const [isShowCurrentDappPopup, setIsShowCurrentDappPopup] = useState(false);

  const handleClose = useMemoizedFn(() => {
    // navigation.goBack();
  });

  const chain = useMemo(() => {
    if (!dapp?.isConnected) {
      return null;
    }
    return findChain({
      enum: dapp.chainId,
    });
  }, [dapp?.chainId, dapp?.isConnected]);

  const inputRef = useRef<any>(null);
  const renderText = useMemo(() => {
    return getAddressBarTitle(url || '');
  }, [url]);

  useEffect(() => {
    if (isFocused) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isFocused]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        setIsShowAccountPopup(false);
        setIsShowCurrentDappPopup(false);
        return false;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => subscription.remove();
    }, []),
  );

  if (isFocused) {
    return (
      <View style={styles.header}>
        <NextSearchBar
          style={styles.searchBar}
          inputStyle={styles.searchBarInput}
          placeholder={
            IS_IOS
              ? t('page.browser.BrowserHeader.searchIos')
              : t('page.browser.BrowserHeader.searchAndroid')
          }
          value={searchText}
          // searchIcon={<RcIconGoogle />}
          autoFocus
          selectTextOnFocus
          alwaysShowCancel
          onChangeText={onSearchTextChange}
          onFocus={() => {
            onFocusChange?.(true);
          }}
          onBlur={() => {
            onFocusChange?.(false);
          }}
          onCancel={() => {
            inputRef.current.blur();
          }}
          ref={inputRef}
          onSubmitEditing={e => {
            inputRef.current.blur();
            onSearch?.(e.nativeEvent.text);
          }}
          enterKeyHint={'go'}
        />
      </View>
    );
  }

  return (
    <>
      <View style={styles.header}>
        {url ? (
          <TouchableOpacity
            style={styles.account}
            onPress={() => {
              if (dapp?.isConnected) {
                setIsShowCurrentDappPopup(true);
              } else {
                setIsShowAccountPopup(true);
              }
            }}>
            {account ? (
              <WalletIcon
                type={account?.type}
                address={account?.address}
                width={24}
                height={24}
                style={styles.walletIcon}
              />
            ) : null}
            {chain ? (
              chain.isTestnet ? (
                <TestnetChainLogo name={chain.name} style={styles.chain} />
              ) : (
                <Image
                  source={{
                    uri: chain.logo,
                  }}
                  style={styles.chain}
                />
              )
            ) : (
              <View style={[styles.chain, styles.disconnect]}>
                <RcIconDisconnectCC
                  color={colors2024['neutral-foot']}
                  width={14}
                  height={14}
                />
              </View>
            )}
          </TouchableOpacity>
        ) : null}
        <View style={styles.addressBar}>
          <TouchableWithoutFeedback
            onPress={() => {
              onSearchTextChange?.(isGoogle(url) ? renderText : url || '');
              onFocusChange?.(true);
            }}>
            {url ? (
              <Text style={styles.addressBarText}>{renderText}</Text>
            ) : (
              <Text style={styles.addressBarPlaceholder}>
                {IS_IOS
                  ? t('page.browser.BrowserHeader.searchIos')
                  : t('page.browser.BrowserHeader.searchAndroid')}
              </Text>
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
      {dapp ? (
        <>
          <CurrentDappPopup
            visible={isShowCurrentDappPopup}
            onClose={() => {
              setIsShowCurrentDappPopup(false);
            }}
            dapp={dapp}
          />
          <AccountSelectorPopup
            visible={isShowAccountPopup}
            onClose={() => {
              setIsShowAccountPopup(false);
            }}
            value={account}
            onChange={v => {
              dappService.updateDapp({
                ...dapp,
                currentAccount: v,
              });
              setIsShowAccountPopup(false);
            }}
          />
        </>
      ) : null}
    </>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 5,
    gap: 12,
    width: '100%',
    // borderBottomWidth: 1,
    // borderBottomColor: colors2024['neutral-line'],
  },
  walletIcon: { borderRadius: 6, width: 32, height: 32 },
  account: {
    position: 'relative',
  },
  chain: {
    position: 'absolute',
    borderRadius: 1000,
    width: 16,
    height: 16,
    borderColor: colors2024['neutral-bg-1'],
    borderWidth: 2,
    borderStyle: 'solid',
    right: -3,
    bottom: -3,
  },
  disconnect: {
    backgroundColor: colors2024['neutral-bg-1'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    textAlign: 'center',
  },
  addressBarPlaceholder: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    textAlign: 'center',
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
