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
      <Image style={styles.image} source={EmptySummaryCardImage} />
      <Text style={styles.title}>Earn Interest, Borrow Anytime</Text>
      <Text style={styles.description}>
        Powered by AAVE. Secure and zero fees.
      </Text>
    </View>
  );
};

export default EmptySummaryCard;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    color: colors2024['red-default'],
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 187,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  image: {
    width: 123,
    height: 99,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
  },
  description: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
  },
}));
