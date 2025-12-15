/**
 * 债务置换、用的是paraswap
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View } from 'react-native';

const DebtSwapActionsViaParaswap = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return <View style={styles.container}>xxx</View>;
};

export default DebtSwapActionsViaParaswap;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    color: colors2024['red-default'],
  },
}));
