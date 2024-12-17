import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import React, { useCallback } from 'react';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { ICONS_COMMON_2024 } from '@/assets2024/icons/common';
import RcIconCorrectCC from './icons/correct-cc.svg';
import { Account } from '@/core/services/preference';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';

const MY_ADDRESS_LIMIT = 3;
export const AddressItemSizes = {
  useAllItemH: 70,
  itemH: 96,
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
  onPressAddress: proponPressAddress,
}: {
  addressItemProps: AddressItemProps & { account: Account };
  isCurrent?: boolean;
  isPinned?: boolean;
  showCopyAndQR?: boolean;
  onPressAddress?: (account: Account) => void;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getAddressItemInPanelStyle,
  });

  const [isPressing, setIsPressing] = React.useState(false);

  const { account } = addressItemProps;
  const onPressAddress = useCallback(() => {
    proponPressAddress?.(account);
  }, [account, proponPressAddress]);

  return (
    <AddressItemShadowView style={style}>
      <TouchableOpacity
        style={StyleSheet.flatten([
          styles.addressItemContainer,
          isCurrent && styles.addressItemContainerCurrent,
          isPressing && styles.containerPressing,
        ])}
        activeOpacity={1}
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
                    {isPinned && (
                      <View style={styles.pinnedWrapper}>
                        <Text style={styles.pinText}>Pin</Text>
                      </View>
                    )}
                  </View>
                  <WalletBalance
                    style={[
                      styles.addressUsdValue,
                      isCurrent && styles.addressUsdValueCurrent,
                    ]}
                  />
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
    </AddressItemShadowView>
  );
}

const getAddressItemInPanelStyle = createGetStyles2024(ctx => {
  return {
    containerPressing: {
      borderColor: ctx.colors2024['brand-light-2'],
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemContainer: {
      borderRadius: 30,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      padding: 24,
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
    walletIcon: { marginRight: 12 },
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
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 22,
    },
    addressUsdValue: {
      marginTop: 6,
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: 22,
      color: ctx.colors2024['neutral-secondary'],
    },
    addressUsdValueCurrent: {
      color: ctx.colors2024['brand-default'],
      fontWeight: '700',
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
    },
  };
});
