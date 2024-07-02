import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '../GlobalBottomSheetModal';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { BottomSheetInput } from '../Input';
import { CheckItem } from './CheckItem';
import { apisLock } from '@/core/apis';
import { FooterButtonGroup } from '../FooterButton/FooterButtonGroup';
import { noop } from 'lodash';
import type { ValidationBehaviorProps } from '@/core/apis/lock';

export interface AuthenticationModalProps extends ValidationBehaviorProps {
  confirmText?: string;
  cancelText?: string;
  title: string;
  description?: string;
  checklist?: string[];
  placeholder?: string;
  onCancel?(): void;
  needPassword?: boolean;
}

export const AuthenticationModal = ({
  title,
  onFinished,
  validationHandler,
  description,
  placeholder,
  onCancel,
  checklist,
  needPassword = true,
}: AuthenticationModalProps) => {
  const { t } = useTranslation();
  const { styles } = useThemeStyles(getStyle);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [checklistState, setChecklistState] = React.useState<boolean[]>(
    checklist?.map(() => false) ?? [],
  );
  const isDisabled = checklistState.includes(false);
  const colors = useThemeColors();

  const handleSubmit = React.useCallback(async () => {
    if (isDisabled) return;

    try {
      if (needPassword) await validationHandler?.(password);
      onFinished?.({ validatedPassword: password });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  }, [isDisabled, needPassword, onFinished, password, validationHandler]);

  React.useEffect(() => {
    setError('');
  }, [password]);

  return (
    <View>
      <AppBottomSheetModalTitle title={title} />

      <View style={styles.main}>
        <View>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>

        {checklist && checklist?.length > 0 && (
          <View style={styles.checklist}>
            {checklist.map((item, index) => (
              <CheckItem
                onPress={() => {
                  const newState = [...checklistState];
                  newState[index] = !newState[index];
                  setChecklistState(newState);
                }}
                checked={checklistState[index]}
                label={item}
                key={index}
              />
            ))}
          </View>
        )}

        {needPassword && (
          <>
            <BottomSheetInput
              secureTextEntry
              returnKeyLabel={t('global.Confirm')}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors['neutral-foot']}
              customStyle={StyleSheet.flatten([
                styles.input,
                error ? styles.errorInput : {},
              ])}
              placeholder={
                placeholder ??
                t('component.AuthenticationModal.passwordPlaceholder')
              }
            />
            <Text style={styles.errorText}>{error}</Text>
          </>
        )}
      </View>
      <FooterButtonGroup
        style={StyleSheet.flatten({
          marginBottom: 40,
        })}
        onCancel={onCancel ?? noop}
        onConfirm={handleSubmit}
      />
    </View>
  );
};

/**
 * @description It's recommended to set `needPassword` property explicitly,
 * whatever it's true or false. If not, it will fetch the lock info from the device.
 *
 */
AuthenticationModal.show = async (props: AuthenticationModalProps) => {
  let needPassword = props.needPassword;
  if (typeof needPassword !== 'boolean') {
    const lockInfo = await apisLock.getRabbyLockInfo();
    needPassword = lockInfo.isUseCustomPwd;
  }
  const id = createGlobalBottomSheetModal({
    name: MODAL_NAMES.AUTHENTICATION,
    bottomSheetModalProps: {
      enableDynamicSizing: true,
    },
    needPassword,
    ...props,
    onCancel() {
      props.onCancel?.();
      removeGlobalBottomSheetModal(id);
    },
    onFinished(ctx) {
      props.onFinished?.(ctx);
      removeGlobalBottomSheetModal(id);
    },
  });
  return null;
};

const getStyle = createGetStyles(colors => {
  return {
    checklist: {
      gap: 12,
      marginBottom: 24,
    },
    description: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
      textAlign: 'center',
    },
    main: {
      paddingHorizontal: 20,
    },
    errorText: {
      color: colors['red-default'],
      marginTop: 12,
      fontSize: 14,
      minHeight: 20,
    },
    errorInput: {
      borderColor: colors['red-default'],
    },
    input: {
      borderColor: colors['neutral-line'],
      backgroundColor: 'transparent',
      borderRadius: 8,
      marginBottom: 0,
      color: colors['neutral-title-1'],
    },
  };
});
