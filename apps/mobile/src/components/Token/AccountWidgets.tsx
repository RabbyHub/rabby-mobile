import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View, ViewStyle } from 'react-native';

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
    <AddressItem account={ownerAccount}>
      {({ WalletIcon }) => {
        return (
          <View style={[styles.accountContainer, containerStyle]}>
            <WalletIcon style={styles.walletIcon} />
            <Text style={styles.accountAddress}>
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
    accountContainer: {
      borderRadius: 12,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    walletIcon: {
      width: 18,
      height: 18,
      borderRadius: 4,
    },
    accountAddress: {
      color: colors2024['neutral-body'],
      fontSize: 14,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
      marginHorizontal: 6,
    },

    filterAccountClose: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
});
