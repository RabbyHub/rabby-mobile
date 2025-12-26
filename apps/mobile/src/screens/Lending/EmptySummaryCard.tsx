import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Image, Text, View } from 'react-native';
import EmptySummaryCardImage from '@/assets2024/images/lending/empty-aave.png';

const EmptySummaryCard = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.topDescription}>
        {t('page.Lending.summary.empty.description')}
      </Text>
      <Image style={styles.image} source={EmptySummaryCardImage} />
      <Text style={styles.title}>{t('page.Lending.summary.empty.title')}</Text>
      <Text style={styles.endDescription}>
        {t('page.Lending.summary.empty.endDesc')}
      </Text>
    </View>
  );
};

export default EmptySummaryCard;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    color: colors2024['red-default'],
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  image: {
    width: 123,
    height: 99,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
  },
  topDescription: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
  },
  endDescription: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    textAlign: 'center',
  },
}));
