import { RcIconWarningCircleCC } from '@/assets2024/icons/common';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

export const MarketClosedTip = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <RcIconWarningCircleCC
        width={18}
        height={18}
        color={colors2024['orange-default']}
      />
      <Text style={styles.text}>{t('page.swap.market-closed')}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginTop: 16,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors2024['orange-light-1'],
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  text: {
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
}));
