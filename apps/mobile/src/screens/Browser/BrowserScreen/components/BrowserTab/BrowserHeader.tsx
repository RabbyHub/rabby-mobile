import React, { useMemo, useState } from 'react';
import {
  Image,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { RcNextSearchCC } from '@/assets/icons/common';
import { RcIconDisconnectCC } from '@/assets/icons/dapp';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { IS_IOS } from '@/core/native/utils';
import { dappService, preferenceService } from '@/core/services';
import { DappInfo } from '@/core/services/dappService';
import { useMyAccounts } from '@/hooks/account';
// import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RcIconTabsCC } from '@/assets2024/icons/browser';
import { useTheme2024 } from '@/hooks/theme';
import { getAddressBarTitle, isGoogle } from '@/utils/browser';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { CurrentDappPopup } from './CurrentDappPopup';

export function BrowserHeader({
  dapp,
  url,
  onViewTabs,
  onLocationBarPress,
  tabsCount,
}: {
  dapp?: DappInfo;
  url?: string;
  onViewTabs?(): void;
  onLocationBarPress?(str?: string): void;
  tabsCount?: number;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

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
        {url && dapp?.isDapp ? (
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
          <RcNextSearchCC
            width={20}
            height={20}
            style={styles.icon}
            color={colors2024['neutral-secondary']}
          />
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
        {/* <View>
          <TouchableOpacity>
            <View style={styles.iconCloseCircle}>
              <RcIconCloseCC
                width={21}
                height={21}
                color={colors2024['neutral-title-1']}
              />
            </View>
          </TouchableOpacity>
        </View> */}
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
    paddingVertical: 8,
    gap: 12,
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
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
  icon: {
    flexShrink: 0,
  },
  addressBar: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
