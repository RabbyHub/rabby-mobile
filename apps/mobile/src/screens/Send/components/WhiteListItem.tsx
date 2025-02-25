import React from 'react';
import { useTranslation } from 'react-i18next';
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
} from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import ArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { trigger } from 'react-native-haptic-feedback';
import { ellipsisAddress } from '@/utils/address';

interface IProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  hiddenArrow?: boolean;
  inWhiteList?: boolean;
}
const WhiteListItem = ({
  account,
  style,
  hiddenArrow,
  inWhiteList,
}: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [isPressing, setIsPressing] = React.useState(false);
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const menuActions = React.useMemo(() => {
    return [
      {
        title: 'remove from whitelist',
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png'),
        androidIconName: 'ic_rabby_menu_un_pin',
        key: 'pin',
        action() {
          console.log('🔍 CUSTOM_LOGGER:=>: handlePinned');
        },
      },
    ] as MenuAction[];
  }, [isDarkTheme]);
  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.aliasName,
        menuActions: menuActions,
      }}
      triggerProps={{ action: 'longPress' }}>
      <AddressItemShadowView>
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
            console.log('🔍 CUSTOM_LOGGER:=>: account', account);
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
                    <WalletIcon
                      style={styles.walletIcon}
                      width={46}
                      height={46}
                    />
                    {inWhiteList && (
                      <ArrowRightCC
                        style={styles.lockIcon}
                        color={
                          isPressing
                            ? colors2024['brand-default']
                            : colors2024['neutral-body']
                        }
                        width={20}
                        height={20}
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
                <ArrowRightCC
                  color={
                    isPressing
                      ? colors2024['brand-default']
                      : colors2024['neutral-body']
                  }
                  width={20}
                  height={20}
                />
              </View>
            )}
          </Card>
        </TouchableOpacity>
      </AddressItemShadowView>
    </ContextMenuView>
  );
};

export default WhiteListItem;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-bg-3'],
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: 0,
    flex: 1,
    flexGrow: 1,
    height: 96,
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
    transform: [{ translateX: 8 }, { translateY: 8 }],
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
