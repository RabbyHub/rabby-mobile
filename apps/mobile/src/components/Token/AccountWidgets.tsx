import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { View, ViewStyle } from 'react-native';
import { Text } from '@/components/Typography';

export function AccountInfoInTokenRow({
  ownerAccount,
  containerStyle,
}: {
  ownerAccount?: Account | null;
  containerStyle?: ViewStyle;
}) {
  const { styles } = useTheme2024({
    getStyle: getAccountInfoInTokenRowStyle,
  });

  if (!ownerAccount) return null;

  return (
    <AddressItem account={ownerAccount} style={styles.root}>
      {({ WalletIcon }) => {
        return (
          <View style={[styles.accountContainer, containerStyle]}>
            <WalletIcon style={styles.walletIcon} />
            <Text
              style={styles.accountAddress}
              numberOfLines={1}
              ellipsizeMode="tail">
              {ownerAccount.aliasName || ellipsisAddress(ownerAccount?.address)}
            </Text>
          </View>
        );
      }}
    </AddressItem>
  );
}

const getAccountInfoInTokenRowStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    root: {
      flexShrink: 1,
      flex: 1,
      width: '100%',
      minWidth: 0,
    },
    accountContainer: {
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexShrink: 1,
      minWidth: 0,
      width: '100%',
    },
    walletIcon: {
      width: 18,
      height: 18,
      borderRadius: 4,
      flexShrink: 0,
    },
    accountAddress: {
      color: colors2024['neutral-body'],
      fontSize: 14,
      lineHeight: 16,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
      marginHorizontal: 6,
      flexShrink: 1,
      flex: 1,
      minWidth: 0,
    },

    filterAccountClose: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
});
