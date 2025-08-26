import { RcIconLong } from '@/assets2024/icons/perps';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const PerpsIntro: React.FC<{}> = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>What’s Perps ?</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.desc}>
          Trading perpetual contracts involves significant risks, including the
          possibility of losing your investment and collateral rapidly due to
          high leverage and market volatility. Such trading may not be suitable
          for all users. Prices may be affected by funding rates and liquidity,
          and you could be automatically liquidated without prior notice. Market
          data is provided by Hyperliquid.
        </Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  section: {},
  header: {
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  card: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
