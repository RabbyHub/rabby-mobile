import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';

import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useFallbackAccount } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { useTranslation } from 'react-i18next';
import { Account } from '@/core/services/preference';

export const PerpsHeaderTitle: React.FC<{
  account?: Account | null;
}> = ({ account }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('page.perps.title')}</Text>
      {account ? (
        <View style={styles.addressContainer}>
          <WalletIcon
            style={styles.walletIcon}
            width={18}
            height={18}
            address={account.address}
          />
          <Text style={styles.address}>
            {account.aliasName || ellipsisAddress(account?.address)}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  addressContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletIcon: {},
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
}));
