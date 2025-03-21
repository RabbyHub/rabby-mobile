import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import {
  AddressItem as InnerAddressItem,
  WalletPin,
} from '@/components2024/AddressItem/AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import { TextBadge } from './PinBadge';
import { addressUtils } from '@rabby-wallet/base-utils';
import ArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';
import { ArrowCircleCC } from '@/assets2024/icons/address';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: 0,
    flex: 1,
    flexGrow: 1,
    height: 78,
    backgroundColor: colors2024['neutral-bg-1'],
    padding: 16,
    paddingRight: 24,
    position: 'relative',
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
    marginRight: 20,
  },
  item: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  itemInfo: {
    gap: 4,
    flexGrow: 1,
    flex: 1,
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  itemNameTextHasPinned: {
    paddingRight: 52,
  },
  itemNamePinned: {
    marginLeft: -52,
  },
  itemBalanceText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 30,
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
  style?: StyleProp<ViewStyle>;
  hiddenArrow?: boolean;
  isPressing?: boolean;
}
export const AddressItemInner2024 = (props: AddressItemProps) => {
  const { account, style, hiddenArrow, isPressing } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });
  const pinned = useMemo(
    () =>
      pinAddresses.some(
        e =>
          addressUtils.isSameAddress(e.address, account.address) &&
          e.brandName === account.brandName,
      ),
    [pinAddresses, account],
  );

  return (
    <Card
      style={StyleSheet.flatten([
        styles.card,
        style,
        isPressing && styles.cardPressing,
      ])}>
      <InnerAddressItem style={styles.rootItem} account={account}>
        {({ WalletIcon, WalletName, WalletBalance }) => (
          <View style={styles.item}>
            <WalletIcon width={46} height={46} borderRadius={12} />
            <View style={styles.itemInfo}>
              <View style={styles.itemName}>
                <WalletName style={StyleSheet.flatten([styles.itemNameText])} />
              </View>
              <WalletBalance style={styles.itemBalanceText} />
            </View>
          </View>
        )}
      </InnerAddressItem>

      {hiddenArrow ? null : (
        <ArrowCircleCC
          style={styles.arrow}
          color={
            isPressing
              ? colors2024['brand-default']
              : colors2024['neutral-body']
          }
          backgroundColor={
            isPressing
              ? colors2024['brand-light-1']
              : colors2024['neutral-bg-2']
          }
        />
      )}

      {pinned ? <WalletPin /> : null}
    </Card>
  );
};
