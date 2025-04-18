import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import React, { useCallback } from 'react';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { ICONS_COMMON_2024 } from '@/assets2024/icons/common';
import RcIconCorrectCC from './icons/correct-cc.svg';
import { Account } from '@/core/services/preference';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { useTopTokensForAddress } from './hooks';
import { AssetAvatar } from '../AssetAvatar';
import { trigger } from 'react-native-haptic-feedback';
import { ContextMenuView } from '@/components2024/ContextMenuView/ContextMenuView';
import { IS_ANDROID } from '@/core/native/utils';
import { getAliasName } from '@/core/apis/contact';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '../AddressViewer/CopyAddress';
import { ellipsisAddress } from '@/utils/address';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import { useTranslation } from 'react-i18next';
import { AccountSwitcherContextMenu } from './ContextMenu';
const MY_ADDRESS_LIMIT = 3;
export const AddressItemSizes = {
  radiusValue: 20,
  useAllItemH: 78,
  itemH: 78,
  itemGap: 12,
  get myAddressesAreaVisiableH() {
    return (
      AddressItemSizes.itemH * MY_ADDRESS_LIMIT +
      AddressItemSizes.itemGap * (MY_ADDRESS_LIMIT - 1)
    );
  },
};

type AddressItemProps = React.ComponentProps<typeof AddressItem>;
export function AddressItemInPanel({
  style,
  addressItemProps,
  isCurrent,
  isPinned,
  isHideToken,
  onPressAddress: proponPressAddress,
}: {
  addressItemProps: AddressItemProps & { account: Account };
  isCurrent?: boolean;
  isPinned?: boolean;
  showCopyAndQR?: boolean;
  onPressAddress?: (account: Account) => void;
  isHideToken?: boolean;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getAddressItemInPanelStyle,
  });

  const { t } = useTranslation();
  const [isPressing, setIsPressing] = React.useState(false);

  const { account } = addressItemProps;
  const onPressAddress = useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    proponPressAddress?.(account);
  }, [account, proponPressAddress]);

  const { tokenList: tokens } = useTopTokensForAddress({
    accountAddress: account?.address,
  });

  return (
    <AddressItemShadowView
      // disableShadow
      style={[
        styles.addressItemView,
        style,
        isCurrent || isPressing ? styles.active : null,
      ]}>
      <AccountSwitcherContextMenu account={account}>
        <TouchableOpacity
          style={StyleSheet.flatten([
            styles.addressItemContainer,
            isCurrent && styles.addressItemContainerCurrent,
            isPressing && styles.containerPressing,
          ])}
          activeOpacity={1}
          delayLongPress={200} // long press delay
          onLongPress={() => {
            trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          }}
          onPressIn={() => setIsPressing(true)}
          onPressOut={() => setIsPressing(false)}
          onPress={onPressAddress}>
          <AddressItem {...addressItemProps}>
            {({ WalletIcon, WalletAddress, WalletBalance, WalletName }) => {
              return (
                <View style={styles.addressItemInner}>
                  <WalletIcon style={styles.walletIcon} />
                  <View style={styles.centerInfo}>
                    <View style={styles.nameAndAdderss}>
                      <WalletName style={styles.addressAliasName} />
                    </View>
                    <View style={styles.bottomArea}>
                      <WalletBalance
                        style={[
                          styles.addressUsdValue,
                          isCurrent && styles.addressUsdValueCurrent,
                        ]}
                      />
                      {!isHideToken && !!tokens?.length && (
                        <>
                          <View style={styles.divider} />
                          <View style={styles.chainLogos}>
                            {tokens.map(item => (
                              <AssetAvatar
                                key={`${item.chain}-${item.id}`}
                                logo={item.logo_url}
                                size={14}
                                logoStyle={styles.chainLogoItem}
                              />
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.rightArea}>
                    {isCurrent && (
                      <RcIconCorrectCC
                        color={colors2024['green-default']}
                        width={16}
                        height={16}
                      />
                    )}
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
    addressItemView: {
      borderRadius: AddressItemSizes.radiusValue,
      overflow: 'hidden',
    },
    active: {
      borderColor: ctx.colors2024['brand-light-2'],
    },
    containerPressing: {
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemContainer: {
      padding: 16,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      height: AddressItemSizes.itemH,
    },
    addressItemContainerCurrent: {
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemInner: {
      flexDirection: 'row',
      height: 52,
      width: '100%',
    },
    walletIcon: { marginRight: 8, width: 46, height: 46 },
    centerInfo: {
      flexDirection: 'column',
      flexShrink: 1,
      width: '100%',
      // ...makeDebugBorder('blue')
    },
    nameAndAdderss: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      // ...makeDebugBorder('yellow'),
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
    addressUsdValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressUsdValueCurrent: {
      // color: ctx.colors2024['brand-default'],
      color: ctx.colors2024['neutral-title-1'],
      fontWeight: '700',
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
      flexShrink: 0,
      marginLeft: 4,
      borderRadius: 6,
      width: 33,
      height: 20,
      flexWrap: 'nowrap',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ctx.colors2024['brand-light-1'],
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
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      // ...makeDebugBorder(),
    },
  };
});
