import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';

import { useFallbackAccount } from '@/hooks/account';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTranslation } from 'react-i18next';
import FastImage from 'react-native-fast-image';

export const PerpsHeaderTitle: React.FC<{ market?: MarketData }> = ({
  market,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const account = useFallbackAccount();

  if (!market) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FastImage style={styles.icon} source={{ uri: market.logoUrl }} />
      <Text style={styles.text}>{market.name} - USD</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  icon: {
    width: 24,
    height: 24,
    borderRadius: 1000,
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
