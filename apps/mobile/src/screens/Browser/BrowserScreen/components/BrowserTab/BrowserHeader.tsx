import React, { useMemo, useState } from 'react';
import {
  Image,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { RcIconDisconnectCC } from '@/assets/icons/dapp';
import {
  RcIconBack1CC,
  RcIconTabsCC,
  ReactIconHome,
} from '@/assets2024/icons/browser';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { IS_IOS } from '@/core/native/utils';
import { dappService } from '@/core/services';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useGetDappAccount } from '@/hooks/useDapps';
import { getAddressBarTitle, isGoogle } from '@/utils/browser';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { CurrentDappPopup } from './CurrentDappPopup';
import { Account } from '@/core/services/preference';

export function BrowserHeader({
  dapp,
  url,
  onViewTabs,
  onLocationBarPress,
  tabsCount,
  canGoBack,
  onGoBack,
  onGoHome,
  onAccountPress,
  account,
}: {
  dapp?: DappInfo;
  url?: string;
  onViewTabs?(): void;
  onLocationBarPress?(str?: string): void;
  tabsCount?: number;
  canGoBack?: boolean;
  account?: Account;
  onGoBack?(): void;
  onGoHome?(): void;
  onAccountPress?(): void;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

  // const account = useGetDappAccount(dapp);

  const chain = useMemo(() => {
    if (!dapp?.isConnected) {
      return null;
    }
    return findChain({
      enum: dapp.chainId,
    });
  }, [dapp?.chainId, dapp?.isConnected]);

  const renderText = useMemo(() => {
    return getAddressBarTitle(url || '');
  }, [url]);

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.navControlItem]} onPress={onGoHome}>
          <ReactIconHome
            width={44}
            height={44}
            color={colors2024['neutral-title-1']}
            backgroundColor={colors2024['neutral-bg-5']}
          />
        </TouchableOpacity>

        <View style={styles.addressBar}>
          <TouchableOpacity disabled={!canGoBack} onPress={onGoBack}>
            <RcIconBack1CC
              width={20}
              height={20}
              color={
                canGoBack
                  ? colors2024['neutral-body']
                  : colors2024['neutral-info']
              }
            />
          </TouchableOpacity>
          <TouchableWithoutFeedback
            onPress={() => {
              onLocationBarPress?.(
                isGoogle(url || '') && !renderText.includes('.')
                  ? renderText || url
                  : url,
              );
            }}>
            <View style={styles.addressBarInner}>
              {url ? (
                <Text style={styles.addressBarText}>{renderText}</Text>
              ) : (
                <Text style={styles.addressBarPlaceholder}>
                  {IS_IOS
                    ? t('page.browser.BrowserHeader.searchIos')
                    : t('page.browser.BrowserHeader.searchAndroid')}
                </Text>
              )}
            </View>
          </TouchableWithoutFeedback>

          <TouchableOpacity
            style={[styles.navControlItem]}
            onPress={onViewTabs}>
            <View style={styles.tabIconContainer}>
              <RcIconTabsCC
                color={colors2024['neutral-body']}
                width={24}
                height={24}
              />
              <View style={styles.tabCountContainer}>
                <Text style={styles.tabCount}>{tabsCount || 0}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
        {url && dapp?.isDapp ? (
          <View style={styles.walletIconContainer}>
            <TouchableOpacity
              style={styles.account}
              onPress={() => {
                onAccountPress?.();
              }}>
              {account ? (
                <WalletIcon
                  type={account?.type}
                  address={account?.address}
                  width={32}
                  height={32}
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
          </View>
        ) : null}
      </View>
    </>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
    width: '100%',
    // backgroundColor: colors2024['neutral-bg-1'],
    // borderBottomWidth: 1,
    // borderBottomColor: colors2024['neutral-line'],
  },
  walletIconContainer: {
    padding: 5,
  },
  walletIcon: {
    borderRadius: 6,
    width: 32,
    height: 32,
  },
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
  icon: {
    flexShrink: 0,
  },
  addressBar: {
    minWidth: 0,
    flex: 1,
    paddingLeft: 12,
    paddingRight: 9,
    paddingVertical: 9,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    height: 42,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressBarInner: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
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

  navControlItem: {
    flexShrink: 0,
  },
  tabIconContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  tabCountContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCount: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
  },
}));
