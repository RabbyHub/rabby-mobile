import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

export const AccountOverview = ({
  account,
}: {
  account: KeyringAccountWithAlias;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <View style={styles.accountBox}>
      <View className="relative">
        <WalletIcon
          type={account.type as KEYRING_TYPE}
          address={account.address}
          width={styles.walletIcon.width}
          height={styles.walletIcon.height}
          style={styles.walletIcon}
        />
      </View>
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
        {account.aliasName}
      </Text>
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  accountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletIcon: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  titleText: {
    flexShrink: 1,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },
}));
