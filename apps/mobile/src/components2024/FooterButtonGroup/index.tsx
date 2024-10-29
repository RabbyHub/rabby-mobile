import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Button } from '@/components2024/Button';

export const FooterButtonGroup: React.FC<{
  onCancel: () => void;
  onConfirm: () => void;
  cancelText?: string;
  confirmText?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ onCancel, onConfirm, cancelText, confirmText, style }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  cancelText = cancelText || t('global.Cancel');
  confirmText = confirmText || t('global.Confirm');

  return (
    <View style={StyleSheet.flatten([styles.buttonGroup, style])}>
      <Button
        containerStyle={styles.btnContainer}
        title={cancelText}
        onPress={onCancel}
        type={'ghost'}
      />
      <View style={styles.btnGap} />

      <Button
        containerStyle={styles.btnContainer}
        title={confirmText}
        onPress={onConfirm}
        type={'primary'}
      />
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  buttonGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },

  btnContainer: {
    flex: 1,
  },

  btnGap: {
    width: 12,
  },
}));
