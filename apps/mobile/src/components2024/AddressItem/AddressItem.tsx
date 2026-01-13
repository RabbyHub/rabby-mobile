import { useCallback, useMemo } from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { addressUtils } from '@rabby-wallet/base-utils';
import { WalletIcon, WalletIconProps } from '../WalletIcon/WalletIcon';
import RcIconPin from '@/assets2024/icons/address/pin-cc.svg';
import { useCurrency } from '@/hooks/useCurrency';
import BigNumber from 'bignumber.js';

const { isSameAddress } = addressUtils;

interface ChildrenProps {
  WalletIcon: React.FC<Omit<WalletIconProps, 'type'>>;
  WalletName: React.FC<{ style?: StyleProp<TextStyle> }>;
  WalletAddress: React.FC<{ style?: StyleProp<TextStyle> }>;
  WalletBalance: React.FC<{ style?: StyleProp<TextStyle> }>;
  WalletPin: typeof WalletPin;
  walletName?: string;
  styles: ReturnType<typeof getStyle>;
}

type AddressItemProps = (
  | {
      account: KeyringAccountWithAlias;
    }
  | {
      address: string;
    }
) & {
  children?: (props: ChildrenProps) => React.ReactNode;
  fetchAccount?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const WalletPin = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  return (
    <View style={[styles.walletPin, style]}>
      <RcIconPin color={colors2024['brand-default']} />
    </View>
  );
};

export const AddressItem = (props: AddressItemProps) => {
  const { styles } = useTheme2024({ getStyle });
  const { accounts } = useAccounts({
    disableAutoFetch: props?.fetchAccount ? false : true,
  });
  const account = useMemo(
    () =>
      'account' in props
        ? props.account
        : accounts.find(a => isSameAddress(a.address, props.address))!,
    [accounts, props],
  );

  const walletName = useMemo(
    () => account?.aliasName || account?.brandName,
    [account?.aliasName, account?.brandName],
  );

  const address = useMemo(
    () => ellipsisAddress(account.address),
    [account?.address],
  );

  const { currency } = useCurrency();

  const usdValue = useMemo(() => {
    const b = new BigNumber(account.balance || 0).times(currency.usd_rate);
    return `${currency.symbol}${splitNumberByStep(
      b.isGreaterThan(10)
        ? b.decimalPlaces(0, BigNumber.ROUND_FLOOR).toString()
        : b.toFixed(2),
    )}`;
  }, [account.balance, currency.symbol, currency.usd_rate]);

  const WalletIconWrapper = useCallback(
    (_props: Omit<WalletIconProps, 'type'>) => {
      return (
        <WalletIcon
          type={account.brandName}
          address={account.address}
          {..._props}
        />
      );
    },
    [account.address, account.brandName],
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
    <View style={props.style}>
      {props.children ? (
        props.children({
          WalletIcon: WalletIconWrapper,
          WalletName,
          WalletAddress,
          WalletBalance,
          walletName,
          WalletPin,
          styles,
        })
      ) : (
        <View style={styles.root}>
          <View style={styles.leftContainer}>
            <WalletIconWrapper
              borderRadius={12}
              address={account.address}
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
    fontFamily: 'SF Pro Rounded',
  },
  middle: {
    gap: 4,
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  rightContainer: {},
  balanceText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  walletPin: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 3,
    backgroundColor: colors2024['brand-light-1'],
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 16,
  },
}));
