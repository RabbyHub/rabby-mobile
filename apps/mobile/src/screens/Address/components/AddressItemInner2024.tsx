import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  KeyringAccountWithAlias,
  useIsNewlyAddedAccount,
  usePinAddresses,
} from '@/hooks/account';
import {
  AddressItem as InnerAddressItem,
  WalletPin,
} from '@/components2024/AddressItem/AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import { addressUtils } from '@rabby-wallet/base-utils';
import { ArrowCircleCC } from '@/assets2024/icons/address';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: 16,
    flex: 1,
    flexGrow: 1,
    height: 78,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    padding: 16,
    overflow: 'hidden',
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
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  newMarkView: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    flexShrink: 0,
    borderRadius: 4,
    backgroundColor: colors2024['brand-light-1'],
  },
  newMarkText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: 500,
    lineHeight: 16,
  },
  balanceContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  itemBalanceText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  percent: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
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
  hiddenPin?: boolean;
  changePercent?: string;
  isLoss?: boolean;
  showMarkIfNewlyAdded?: boolean;
}
export const AddressItemInner2024 = ({
  account,
  style,
  hiddenArrow,
  isPressing,
  hiddenPin,
  changePercent,
  isLoss,
  showMarkIfNewlyAdded = false,
}: AddressItemProps) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

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
  const isZeroPercentChange = changePercent === '0%';

  const { isNewlyAdded } = useIsNewlyAddedAccount(account);

  const shouldShowNewMark =
    showMarkIfNewlyAdded && isNewlyAdded && account.evmBalance === 0;

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
            <WalletIcon
              address={account.address}
              width={46}
              height={46}
              borderRadius={12}
            />
            <View style={styles.itemInfo}>
              <View style={styles.itemName}>
                <WalletName style={StyleSheet.flatten([styles.itemNameText])} />
                {shouldShowNewMark && (
                  <View style={styles.newMarkView}>
                    <Text style={styles.newMarkText}>New</Text>
                  </View>
                )}
              </View>
              <View style={styles.balanceContainer}>
                <WalletBalance style={styles.itemBalanceText} />
                {typeof changePercent === 'string' && (
                  <Text
                    style={[
                      styles.percent,
                      {
                        color: !isZeroPercentChange
                          ? isLoss
                            ? colors2024['red-default']
                            : colors2024['green-default']
                          : colors2024['neutral-secondary'],
                      },
                    ]}>{`${
                    isZeroPercentChange ? '' : isLoss ? '-' : '+'
                  }${changePercent}`}</Text>
                )}
              </View>
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
              : isLight
              ? colors2024['neutral-bg-2']
              : colors2024['neutral-bg-1']
          }
        />
      )}

      {pinned && !hiddenPin ? <WalletPin /> : null}
    </Card>
  );
};
