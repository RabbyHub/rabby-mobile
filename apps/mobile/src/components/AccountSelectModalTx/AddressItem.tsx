/* eslint-disable react-native/no-inline-styles */
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import React, { useCallback, useMemo } from 'react';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Account } from '@/core/services/preference';
import { trigger } from 'react-native-haptic-feedback';
import { toast } from '@/components2024/Toast';
import { TxAccountPannelSectionTitle } from '@/constant/newStyle';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { ellipsisAddress } from '@/utils/address';
import { IS_ANDROID } from '@/core/native/utils';
import { AccountSwitcherContextMenu } from '../AccountSwitcher/ContextMenu';

const SIZES = {
  itemH: 78,
  itemGap: 12,
};

const triggerLight = () => {
  trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
};

type AddressItemProps = React.ComponentProps<typeof AddressItem>;
export function AddressItemInSheetModal({
  ofTitleType,
  recentAddressData,
  style,
  addressItemProps,
  isCurrent,
  isPinned,
  showCopyAndQR,
  replaceNameWithAliasAddress,
  defaultPressAction = showCopyAndQR ? 'copy' : 'asPress',
  isHideToken,
  onPressAccount: proponPressAddress,
}: {
  ofTitleType?: TxAccountPannelSectionTitle;
  recentAddressData?: {
    account: Account;
    lastUsedTime: number;
  } | null;
  addressItemProps: AddressItemProps & { account: Account };
  isCurrent?: boolean;
  isPinned?: boolean;
  showCopyAndQR?: boolean;
  replaceNameWithAliasAddress?: boolean;
  defaultPressAction?: 'copy' | 'asPress';
  isHideToken?: boolean;
  onPressAccount?: (account: Account) => void;
  isReceive?: boolean;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getAddressItemInPanelStyle,
  });

  const [isPressing, setIsPressing] = React.useState(false);

  const { account } = addressItemProps;
  const onPressAccount = useCallback(() => {
    proponPressAddress?.(account);
  }, [account, proponPressAddress]);

  const handleCopyAddress = () => {
    triggerLight();
    if (!account?.address) {
      return;
    }
    Clipboard.setString(account.address);
    toast.success('Copied successfully');
  };

  return (
    <AddressItemShadowView
      style={isCurrent || isPressing ? styles.active : null}>
      <AccountSwitcherContextMenu account={account}>
        <TouchableOpacity
          style={StyleSheet.flatten([
            styles.addressItemContainer,
            style,
            isCurrent && styles.addressItemContainerCurrent,
            isPressing && styles.containerPressing,
          ])}
          activeOpacity={1}
          delayLongPress={200}
          onPressIn={() => setIsPressing(true)}
          onPressOut={() => setIsPressing(false)}
          onLongPress={() => {
            trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          }}
          onPress={() => {
            triggerLight();
            defaultPressAction === 'copy'
              ? handleCopyAddress?.()
              : onPressAccount?.();
          }}>
          <AddressItem {...addressItemProps}>
            {({
              WalletIcon,
              WalletAddress,
              WalletBalance,
              WalletName,
              walletName,
            }) => {
              const hasAlias =
                walletName?.toLowerCase() !==
                ellipsisAddress(account.address).toLowerCase();
              return (
                <View style={styles.addressItemInner}>
                  <View style={styles.walletIconWrapper}>
                    <WalletIcon style={styles.walletIcon} />
                  </View>
                  <View style={styles.centerInfo}>
                    <View style={styles.nameAndAddress}>
                      {[
                        TxAccountPannelSectionTitle.Recent,
                        TxAccountPannelSectionTitle.Whitelist,
                      ].includes(ofTitleType!) ? (
                        <WalletName style={styles.addressAliasName} />
                      ) : (
                        <Text style={styles.addressAlias} numberOfLines={1}>
                          {hasAlias ? (
                            <>
                              <WalletName style={styles.addressAlias} />
                              <Text style={styles.addressTruncate}>
                                ({ellipsisAddress(account.address)})
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.addressAlias}>
                              {ellipsisAddress(account.address)}
                            </Text>
                          )}
                        </Text>
                      )}
                    </View>
                    <View style={styles.bottomArea}>
                      <WalletBalance
                        style={[
                          styles.addressUsdValue,
                          isCurrent && styles.addressUsdValueCurrent,
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            }}
          </AddressItem>
        </TouchableOpacity>
      </AccountSwitcherContextMenu>
    </AddressItemShadowView>
  );
}

const getAddressItemInPanelStyle = createGetStyles2024(ctx => {
  return {
    active: {
      borderColor: ctx.colors2024['brand-light-2'],
    },
    containerPressing: {
      borderColor: ctx.colors2024['brand-light-2'],
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemContainer: {
      borderRadius: 16,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-1']
        : ctx.colors2024['neutral-bg-2'],
      padding: 16,
      paddingRight: 24,
      height: SIZES.itemH,
    },
    addressItemContainerCurrent: {
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemInner: {
      flexDirection: 'row',
      alignItems: 'center',
      // height: 52,
      width: '100%',
    },
    walletIconWrapper: {
      width: 46,
      height: 46,
      marginRight: 8,
      position: 'relative',
    },
    walletIcon: { width: 46, height: 46, borderRadius: 12 },
    centerInfo: {
      flex: 1,
      flexShrink: 1,
      flexDirection: 'column',
      marginRight: 20,
    },
    nameAndAddress: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    addressTruncate: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
      color: ctx.colors2024['neutral-info'],
      lineHeight: 20,
    },
    addressAlias: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: 20,
      color: ctx.colors2024['neutral-foot'],
      flexGrow: IS_ANDROID ? 1 : 0,
    },
    addressUsdValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressUsdValueCurrent: {
      color: ctx.colors2024['neutral-title-1'],
      fontWeight: '700',
    },
    addressAliasName: {
      flexShrink: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontStyle: 'normal',
      fontWeight: '500',
      color: ctx.colors2024['neutral-foot'],
    },
    bottomArea: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      width: '100%',
      marginTop: 6,
    },
    divider: {
      height: 12,
      maxHeight: '100%',
      width: 1,
      backgroundColor: ctx.colors2024['brand-light-1'],
      marginHorizontal: 8,
    },
    chainLogos: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 2,
    },
    chainLogoItem: {
      opacity: 0.8,
    },

    pinnedWrapper: {
      width: 33,
      height: 20,
      marginLeft: 4,
      borderRadius: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ctx.colors2024['brand-light-1'],
      flexWrap: 'nowrap',
    },
    pinText: {
      color: ctx.colors2024['brand-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 18,
    },
    pinIcon: {
      color: ctx.colors2024['brand-default'],
    },

    rightArea: {
      // width: 72,
    },
    iconList: {
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
    },
    icon: {
      width: 13,
      height: 13,
    },
  };
});
