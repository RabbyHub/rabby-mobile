import { RcIconWarningCircleCC } from '@/assets2024/icons/common';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, View, ViewStyle } from 'react-native';

export const GasAccountWarning: React.FC<{
  balance?: number | string | null;
  message?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ message, style, balance }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const DEFAULT_MESSAGE = t('page.gasAccount.lowBalance');

  if (Number(balance ?? 0) >= 1) {
    return null;
  }
  return (
    <View style={[styles.container, style]}>
      <RcIconWarningCircleCC
        width={14}
        height={14}
        color={colors2024['orange-default']}
        style={styles.warn}
      />
      <Text style={styles.text}>{message || DEFAULT_MESSAGE}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors2024['orange-light-1'],
  },
  warn: {
    position: 'relative',
    top: 2,
  },
  text: {
    flex: 1,
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
