import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';

import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useFallbackAccount } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { useTranslation } from 'react-i18next';

export const PerpsHeaderTitle: React.FC<{}> = ({}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const account = useFallbackAccount();

  return (
    <View style={styles.container}>
      <View style={styles.icon} />
      <Text style={styles.text}>ETH - USD</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  icon: {
    width: 24,
    height: 24,
    borderRadius: 1000,
    backgroundColor: 'red',
  },
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
