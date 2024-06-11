import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../Button';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '../GlobalBottomSheetModal';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { BottomSheetInput } from '../Input';

export interface AuthenticationModalProps {
  validationHandler?(password: string): Promise<void>;
  confirmText?: string;
  cancelText?: string;
  title: string;
  description?: string;
  checklist?: string[];
  placeholder?: string;
  onFinished?(...args: any[]): void;
  onCancel?(): void;
}

export const AuthenticationModal = ({
  title,
  onFinished,
  validationHandler,
  description,
  placeholder,
  onCancel,
}: AuthenticationModalProps) => {
  const { t } = useTranslation();
  const { styles } = useThemeStyles(getStyle);
  const [password, setPassword] = React.useState('');

  const handleSubmit = React.useCallback(async () => {
    await validationHandler?.(password);

    onFinished?.();
  }, [onFinished, password, validationHandler]);

  return (
    <View>
      <AppBottomSheetModalTitle title={title} />

      <View style={styles.main}>
        <View>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>

        <BottomSheetInput
          value={password}
          onChangeText={setPassword}
          placeholder={
            placeholder ??
            t('component.AuthenticationModal.passwordPlaceholder')
          }
        />
      </View>
      <View style={styles.buttonGroup}>
        <Button
          title={t('global.Cancel')}
          containerStyle={styles.btnContainer}
          buttonStyle={styles.cancelStyle}
          titleStyle={styles.cancelTitleStyle}
          onPress={onCancel}
        />
        <View style={styles.btnGap} />

        <Button
          title={t('global.Confirm')}
          containerStyle={styles.btnContainer}
          buttonStyle={styles.confirmStyle}
          titleStyle={styles.confirmTitleStyle}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
};

AuthenticationModal.show = (props: AuthenticationModalProps) => {
  const id = createGlobalBottomSheetModal({
    name: MODAL_NAMES.AUTHENTICATION,
    ...props,
    onCancel() {
      props.onCancel?.();
      removeGlobalBottomSheetModal(id);
    },
    onFinished() {
      props.onFinished?.();
      removeGlobalBottomSheetModal(id);
    },
  });
  return null;
};

const getStyle = createGetStyles(colors => {
  return {
    description: {
      color: colors['neutral-body'],
      fontSize: 16,
      lineHeight: 22,
      marginBottom: 24,
    },
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
    main: {
      paddingHorizontal: 20,
    },
  };
});
