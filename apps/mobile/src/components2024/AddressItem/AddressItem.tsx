import { useCallback } from 'react';
import { StyleProp, StyleSheet, View, TextStyle } from 'react-native';
import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { addressUtils } from '@rabby-wallet/base-utils';
import { WalletIcon, WalletIconProps } from '../WalletIcon/WalletIcon';

const { isSameAddress } = addressUtils;

interface ChildrenProps {
  WalletIcon: React.FC<{
    height: number;
    width: number;
    style?: StyleProp<TextStyle>;
  }>;
  WalletName: React.FC<{ style?: StyleProp<TextStyle> }>;
  WalletAddress: React.FC<{ style?: StyleProp<TextStyle> }>;
  WalletBalance: React.FC<{ style?: StyleProp<TextStyle> }>;
}

type AddressItemProps =
  | {
      account: KeyringAccountWithAlias;
      isLight?: boolean;
      children?: (props: ChildrenProps) => React.ReactNode;
    }
  | {
      address: string;
      isLight?: boolean;
      children?: (props: ChildrenProps) => React.ReactNode;
    };

export const AddressItem = (props: AddressItemProps) => {
  const { isLight } = props;
  const { accounts } = useAccounts();
  const account =
    'account' in props
      ? props.account
      : accounts.find(a => isSameAddress(a.address, props.address))!;

  const { styles } = useTheme2024({ getStyle });

  const walletName = account?.aliasName || account?.brandName;
  const address = ellipsisAddress(account.address);
  const usdValue = `$${splitNumberByStep(account.balance?.toFixed(2) || 0)}`;

  const WalletIconWrapper = useCallback(
    (_props: Omit<WalletIconProps, 'isLight' | 'type'>) => {
      return (
        <WalletIcon type={account.brandName} isLight={isLight} {..._props} />
      );
    },
    [account.brandName, isLight],
  );
  const WalletName = useCallback(
    ({ style }: { style?: StyleProp<TextStyle> }) => {
      return (
        <Text
          style={StyleSheet.flatten([styles.aliasNameText, style])}
          numberOfLines={1}>
          {walletName}
        </Text>
      );
    },
    [styles.aliasNameText, walletName],
  );

  const WalletAddress = useCallback(
    ({ style }: { style?: StyleProp<TextStyle> }) => {
      return (
        <Text style={StyleSheet.flatten([styles.addressText, style])}>
          {address}
        </Text>
      );
    },
    [styles.addressText, address],
  );

  const WalletBalance = useCallback(
    ({ style }: { style?: StyleProp<TextStyle> }) => {
      return (
        <Text style={StyleSheet.flatten([styles.balanceText, style])}>
          {usdValue}
        </Text>
      );
    },
    [styles.balanceText, usdValue],
  );

  return (
    <View>
      {props.children ? (
        props.children({
          WalletIcon: WalletIconWrapper,
          WalletName,
          WalletAddress,
          WalletBalance,
        })
      ) : (
        <View style={styles.root}>
          <View style={styles.leftContainer}>
            <WalletIconWrapper
              width={styles.walletIcon.width}
              height={styles.walletIcon.height}
            />
            <View style={styles.middle}>
              <WalletName />
              <WalletAddress />
            </View>
          </View>
          <View style={styles.rightContainer}>
            <WalletBalance />
          </View>
        </View>
      )}
    </View>
  );
};

export const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
  },
  leftContainer: {
    gap: 10,
    alignItems: 'center',
    flexDirection: 'row',
  },
  walletIcon: {
    width: 36,
    height: 36,
  },
  aliasNameText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  middle: {
    gap: 4,
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  rightContainer: {},
  balanceText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
