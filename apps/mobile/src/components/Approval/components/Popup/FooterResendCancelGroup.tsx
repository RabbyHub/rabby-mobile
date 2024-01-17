import { Button } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

export interface Props {
  onResend: () => void;
  onCancel: () => void;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      gap: 16,
    },
    buttonStyle: {
      backgroundColor: colors['blue-default'],
      borderColor: colors['blue-default'],
      height: 40,
      width: 148,
      borderRadius: 8,
    },
    buttonTitleStyle: {
      color: colors['neutral-title-2'],
    },
  });

export const FooterResendCancelGroup: React.FC<Props> = ({
  onResend,
  onCancel,
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.wrapper}>
      <Button
        titleStyle={styles.buttonTitleStyle}
        buttonStyle={styles.buttonStyle}
        type="clear"
        onPress={onResend}
        title={t('page.signFooterBar.resend')}
      />
      <Button
        titleStyle={styles.buttonTitleStyle}
        buttonStyle={styles.buttonStyle}
        type="clear"
        onPress={onCancel}
        title={t('global.cancelButton')}
      />
    </View>
  );
};
