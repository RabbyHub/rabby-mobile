import React, { useLayoutEffect, useState } from 'react';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Pressable,
  Image,
} from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { trigger } from 'react-native-haptic-feedback';
import { ellipsisAddress } from '@/utils/address';
import { RcIconLockCC, RcIconSwitchCC } from '@/assets/icons/send';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { useWhitelist } from '@/hooks/whitelist';
import { Cex } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';

interface IProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  cexDes?: Cex;
  hiddenArrow?: boolean;
  inWhiteList?: boolean;
}
export const WhiteListItem = ({
  account,
  style,
  hiddenArrow,
  inWhiteList,
}: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [cexDesc, setCexDesc] = useState<Cex | undefined>();
  const [isPressing, setIsPressing] = React.useState(false);
  const { removeWhitelist } = useWhitelist({ disableAutoFetch: true });
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { navigation } = useSafeSetNavigationOptions();

  useLayoutEffect(() => {
    openapi.addrDesc(account.address).then(res => {
      if (res.desc.cex) {
        setCexDesc(res.desc.cex);
      }
    });
  }, [account.address]);

  const menuActions = React.useMemo(() => {
    return [
      {
        title: 'Remove from Whitelist ',
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png'),
        androidIconName: 'ic_rabby_menu_un_pin',
        key: 'pin',
        action() {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
          removeWhitelist(account.address);
        },
      },
    ] as MenuAction[];
  }, [account.address, isDarkTheme, removeWhitelist]);
  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.aliasName,
        menuActions: menuActions,
      }}
      preViewBorderRadius={20}
      triggerProps={{ action: 'longPress' }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        style={StyleSheet.flatten([
          styles.root,
          isPressing && styles.rootPressing,
        ])}
        delayLongPress={200} // long press delay
        onPress={() => {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
          if (inWhiteList) {
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.Send,
              params: {
                toAddress: account.address,
                cexDes: cexDesc,
                addressBrandName: account.brandName,
              },
            });
          } else {
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.ConfirmAddress,
              params: {
                account,
              },
            });
          }
        }}
        onLongPress={() => {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }}>
        <Card
          style={StyleSheet.flatten([
            styles.card,
            style,
            isPressing && styles.cardPressing,
          ])}>
          <InnerAddressItem style={styles.rootItem} account={account}>
            {({ WalletIcon, WalletName, WalletBalance }) => (
              <View style={styles.item}>
                <View style={styles.iconWrapper}>
                  {cexDesc?.logo_url ? (
                    <Image
                      source={{ uri: cexDesc?.logo_url }}
                      style={styles.walletIcon}
                      width={46}
                      height={46}
                    />
                  ) : (
                    <WalletIcon
                      style={styles.walletIcon}
                      width={46}
                      height={46}
                    />
                  )}
                  {inWhiteList && (
                    <RcIconLockCC
                      style={styles.lockIcon}
                      color={
                        isPressing
                          ? colors2024['brand-default']
                          : colors2024['neutral-body']
                      }
                      width={22}
                      height={22}
                    />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <View style={styles.itemName}>
                    <WalletName style={styles.itemNameText} />
                    <Text style={styles.address}>
                      {`(${ellipsisAddress(account.address)})`}
                    </Text>
                  </View>
                  <WalletBalance style={styles.itemBalanceText} />
                </View>
              </View>
            )}
          </InnerAddressItem>

          {hiddenArrow ? null : (
            <View
              style={StyleSheet.flatten([
                styles.arrow,
                isPressing && styles.arrowPressing,
              ])}>
              <RcIconSwitchCC
                color={
                  isPressing
                    ? colors2024['brand-default']
                    : colors2024['neutral-body']
                }
                width={24}
                height={24}
              />
            </View>
          )}
        </Card>
      </TouchableOpacity>
    </ContextMenuView>
  );
};
export const WhiteListItemSwitch = ({
  account,
  style,
  cexDes,
  inWhiteList,
}: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { navigation } = useSafeSetNavigationOptions();

  return (
    <View style={styles.root}>
      <Card style={StyleSheet.flatten([styles.card, style])}>
        <InnerAddressItem style={styles.rootItem} account={account}>
          {({ WalletIcon, WalletName, WalletBalance }) => (
            <View style={styles.item}>
              <View style={styles.iconWrapper}>
                {cexDes?.logo_url ? (
                  <Image
                    source={{ uri: cexDes?.logo_url }}
                    style={styles.walletIcon}
                    width={46}
                    height={46}
                  />
                ) : (
                  <WalletIcon
                    style={styles.walletIcon}
                    width={46}
                    height={46}
                  />
                )}
                {inWhiteList && (
                  <RcIconLockCC
                    style={styles.lockIcon}
                    color={colors2024['neutral-body']}
                    width={22}
                    height={22}
                  />
                )}
              </View>
              <View style={styles.itemInfo}>
                <View style={styles.itemName}>
                  {cexDes?.name ? (
                    <Text style={styles.itemNameText}>{cexDes.name}</Text>
                  ) : (
                    <WalletName style={styles.itemNameText} />
                  )}
                  <Text style={styles.address}>
                    {`(${ellipsisAddress(account.address)})`}
                  </Text>
                </View>
                <WalletBalance style={styles.itemBalanceText} />
              </View>
            </View>
          )}
        </InnerAddressItem>
        <Pressable
          style={styles.arrow}
          onPress={() => {
            navigation.dispatch(
              StackActions.push(RootNames.StackTransaction, {
                screen: RootNames.SendTo,
                params: {},
              }),
            );
          }}>
          <RcIconSwitchCC
            color={colors2024['neutral-body']}
            width={24}
            height={24}
          />
        </Pressable>
      </Card>
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-bg-3'],
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
  },
  shadowView: {
    borderRadius: 20,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 20,
    flex: 1,
    flexGrow: 1,
    backgroundColor: colors2024['neutral-bg-1'],
    padding: 16,
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
    marginRight: 20,
  },
  item: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 46,
    height: 46,
    position: 'relative',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    transform: [{ translateX: 5 }, { translateY: 2 }],
  },
  itemInfo: {
    gap: 6,
    flexGrow: 1,
    flex: 1,
  },
  itemNameText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  itemNameTextHasPinned: {
    paddingRight: 52,
  },
  itemNamePinned: {
    marginLeft: -52,
  },
  itemBalanceText: {
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  arrow: {
    width: 30,
    height: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressing: {
    backgroundColor: colors2024['brand-light-1'],
  },
  arrowPressing: {
    backgroundColor: colors2024['brand-light-1'],
  },
  walletIcon: {
    borderRadius: 12,
  },
}));
