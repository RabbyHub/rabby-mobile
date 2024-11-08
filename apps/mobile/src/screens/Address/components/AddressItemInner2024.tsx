import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import { PinBadge } from './PinBadge';
import { addressUtils } from '@rabby-wallet/base-utils';
import ArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: 0,
  },
  item: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  itemInfo: {
    gap: 6,
  },
  itemNameText: {
    fontSize: 17,
    lineHeight: 22,
  },
  itemBalanceText: {
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
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
}));

interface AddressItemProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  hiddenArrow?: boolean;
}
export const AddressItemInner2024 = (props: AddressItemProps) => {
  const { account, style, hiddenArrow } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });
  const pinned = useMemo(
    () =>
      pinAddresses.some(e =>
        addressUtils.isSameAddress(e.address, account.address),
      ),
    [pinAddresses, account],
  );

  return (
    <Card style={StyleSheet.flatten([styles.card, style])}>
      <InnerAddressItem account={account}>
        {({ WalletIcon, WalletName, WalletBalance }) => (
          <View style={styles.item}>
            <WalletIcon width={40} height={40} />
            <View style={styles.itemInfo}>
              <View style={styles.itemName}>
                <WalletName style={styles.itemNameText} />
                {pinned && <PinBadge />}
              </View>
              <WalletBalance style={styles.itemBalanceText} />
            </View>
          </View>
        )}
      </InnerAddressItem>

      {hiddenArrow ? null : (
        <View style={styles.arrow}>
          <ArrowRightCC
            color={colors2024['neutral-body']}
            width={20}
            height={20}
          />
        </View>
      )}
    </Card>
  );
};
