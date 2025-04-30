import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Button } from '@/components2024/Button';
import AuthButton from '../AuthButton';

export const FooterButtonGroup: React.FC<{
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelText?: string;
  confirmText?: string;
  confirmType?: 'primary' | 'ghost';
  disable?: boolean;
  confirmDisabled?: boolean;
  loading?: boolean;
  authButton?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({
  onCancel,
  onConfirm,
  cancelText,
  confirmText,
  confirmType,
  style,
  disable,
  loading,
  authButton,
  confirmDisabled,
}) => {
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
        disabled={disable}
        loading={loading}
        type={'ghost'}
      />
      <View style={styles.btnGap} />

      {authButton ? (
        <AuthButton
          containerStyle={styles.btnContainer}
          title={confirmText}
          onFinished={onConfirm}
          disabled={disable || confirmDisabled}
          loading={loading}
          type={confirmType || 'primary'}
        />
      ) : (
        <Button
          containerStyle={styles.btnContainer}
          title={confirmText}
          onPress={onConfirm}
          disabled={disable || confirmDisabled}
          loading={loading}
          type={confirmType || 'primary'}
        />
      )}
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
