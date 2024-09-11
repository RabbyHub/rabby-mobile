import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Button } from '@/components';

export const FooterButtonGroup: React.FC<{
  onCancel: () => void;
  onConfirm: () => void;
  cancelText?: string;
  confirmText?: string;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  disabled?: boolean;
}> = ({
  onCancel,
  onConfirm,
  cancelText,
  confirmText,
  style,
  loading,
  disabled,
}) => {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  cancelText = cancelText || t('global.Cancel');
  confirmText = confirmText || t('global.Confirm');

  return (
    <View style={StyleSheet.flatten([styles.buttonGroup, style])}>
      <Button
        title={cancelText}
        containerStyle={styles.btnContainer}
        buttonStyle={styles.cancelStyle}
        titleStyle={styles.cancelTitleStyle}
        onPress={onCancel}
      />
      <View style={styles.btnGap} />

      <Button
        title={confirmText}
        containerStyle={styles.btnContainer}
        buttonStyle={styles.confirmStyle}
        titleStyle={styles.confirmTitleStyle}
        onPress={onConfirm}
        loading={loading}
        disabled={disabled}
      />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  buttonGroup: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 28,
  },

  btnContainer: {
    flex: 1,
    height: 50,
  },

  cancelStyle: {
    backgroundColor: colors['neutral-card-1'],
    borderColor: colors['blue-default'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 8,
    height: '100%',
    width: '100%',
  },
  cancelTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['blue-default'],
    flex: 1,
  },
  btnGap: {
    width: 13,
  },
  confirmStyle: {
    backgroundColor: colors['blue-default'],
    borderRadius: 8,
    width: '100%',
    height: '100%',
  },
  confirmTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['neutral-title2'],
    flex: 1,
  },
}));
