import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { trigger } from 'react-native-haptic-feedback';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { Card } from '@/components2024/Card';
import ArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';
import { BadgeText } from '@/screens/Home/components/HomeTopArea';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
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
  badgeStyle: {
    width: 20,
    lineHeight: 20,
    height: 20,
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    width: 30,
    height: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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

interface AddressItemProps {
  account: KeyringAccountWithAlias;
  alertCount?: number;
  lastSelectedAccount?: KeyringAccountWithAlias;
  onSelect?: () => void;
}
/**
 * TODO: badge approval amount
 */
export const AddressItemEntry = (props: AddressItemProps) => {
  const { account, onSelect, alertCount } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [isPressing, setIsPressing] = React.useState(false);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => setIsPressing(true)}
      onPressOut={() => setIsPressing(false)}
      style={StyleSheet.flatten([
        styles.root,
        isPressing && styles.rootPressing,
      ])}
      delayLongPress={200} // long press delay
      onPress={onSelect}
      onLongPress={() => {
        trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }}>
      <Card
        style={StyleSheet.flatten([
          styles.card,
          isPressing && styles.cardPressing,
        ])}>
        <InnerAddressItem style={styles.rootItem} account={account}>
          {({ WalletIcon, WalletName, WalletBalance }) => (
            <View style={styles.item}>
              <WalletIcon style={styles.walletIcon} width={40} height={40} />
              <View style={styles.itemInfo}>
                <View style={styles.itemName}>
                  <WalletName style={styles.itemNameText} />
                </View>
                <WalletBalance style={styles.itemBalanceText} />
              </View>
            </View>
          )}
        </InnerAddressItem>

        <View style={styles.right}>
          {!!alertCount && alertCount > 0 && (
            <BadgeText count={alertCount} style={styles.badgeStyle} />
          )}
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
        </View>
      </Card>
    </TouchableOpacity>
  );
};
