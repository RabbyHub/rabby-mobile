import React from 'react';
import { Text, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import WarningFillCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { useTranslation } from 'react-i18next';

const BorrowToCapTip = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <WarningFillCC width={18} height={18} color={colors2024['red-default']} />
      <Text style={styles.text}>
        {t('page.Lending.borrowOverview.reachCapTip')}
      </Text>
    </View>
  );
};

export default BorrowToCapTip;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors2024['red-light-1'],
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
}));
