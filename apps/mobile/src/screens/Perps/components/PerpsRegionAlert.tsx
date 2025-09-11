import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';

import { RcIconWarningCC } from '@/assets2024/icons/common';
import { useTranslation } from 'react-i18next';

export const PerpsRegionAlert: React.FC<{}> = ({}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <RcIconWarningCC color={colors2024['orange-default']} />
      <Text style={styles.text}>{t('page.perps.regionNotSupport')}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    backgroundColor: colors2024['orange-light-1'],
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 12,
    marginHorizontal: 16,
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['orange-default'],
  },
}));
