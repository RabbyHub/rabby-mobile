import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import { openapi } from '@/core/request';
import { useAppLanguage } from '@/hooks/lang';
import { useRequest } from 'ahooks';
import { PerpTopTokenV3 } from '@rabby-wallet/rabby-api/dist/types';

export const PerpsAbout: React.FC<{
  coin: string;
}> = ({ coin }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { currentLanguage } = useAppLanguage();

  const { data: tokenDetail } = useRequest(
    () =>
      openapi.getPerpTokenDetail({
        name: coin,
        lang: currentLanguage,
      }),
    { refreshDeps: [coin, currentLanguage] },
  );

  const aboutContent = tokenDetail?.description;

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
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  card: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-3'],
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
