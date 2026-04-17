import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import { getPerpsAboutContent } from '@/constant/perpsAbout';
import { formatPerpsCoin } from '@/utils/perps';

export const PerpsAbout: React.FC<{
  coin: string;
  description?: string;
}> = ({ coin, description }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const baseCoin = formatPerpsCoin(coin);
  // Prefer description from MarketData (API/JSON), fallback to hardcoded perpsAbout
  const aboutContent =
    description ||
    (getPerpsAboutContent(coin) ?? getPerpsAboutContent(baseCoin));

  if (!aboutContent) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('page.perpsDetail.PerpsAbout.title')}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.desc}>{aboutContent}</Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  section: {
    marginBottom: 24,
  },
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-5']
      : colors2024['neutral-bg-3'],
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
