import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/Typography';

export interface Props {
  onResend: () => void;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    text: {
      fontSize: 18,
      lineHeight: 22,
      textDecorationLine: 'underline',
      color: colors['neutral-body'],
    },
  });

export const FooterResend: React.FC<Props> = ({ onResend }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity onPress={onResend}>
      <Text style={styles.text}>{t('page.signFooterBar.resend')}</Text>
    </TouchableOpacity>
  );
};
