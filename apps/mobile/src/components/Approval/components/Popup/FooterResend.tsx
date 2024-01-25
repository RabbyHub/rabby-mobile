import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export interface Props {
  onResend: () => void;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    text: {
      fontSize: 15,
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
