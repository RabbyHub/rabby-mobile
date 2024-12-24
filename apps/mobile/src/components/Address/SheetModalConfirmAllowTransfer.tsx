import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';

import * as Yup from 'yup';
import { useFormik } from 'formik';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheetModalConfirmContainer } from '@/components/customized/BottomSheetModalConfirmContainer';

import { useWhitelist } from '@/hooks/whitelist';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { RcIconCheckedFilledCC, RcIconUnCheckCC } from '@/assets/icons/send';
import TouchableView from '@/components/Touchable/TouchableView';
import ThemeIcon from '@/components/ThemeMode/ThemeIcon';
import { useTranslation } from 'react-i18next';
import { FormInput } from '@/components/Form/Input';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { getFormikErrorsCount } from '@/utils/patch';
import { apisLock } from '@/core/apis';
import { toast } from '@/components/Toast';
import { useLoadLockInfo } from '@/hooks/useLock';
import { BiometricsIcon } from '@/components/AuthenticationModal/BiometricsIcon';
import { useAuthenticationModal } from '@/components/AuthenticationModal/hooks';
import usePrevious from 'react-use/lib/usePrevious';

interface ConfirmAllowTransferModalProps {
  toAddr: string;
  showAddToWhitelist?: boolean;
  onFinished: (result: { isAddToWhitelist: boolean }) => void;
  onCancel(): void;
}

function useConfirmAllowForm() {
  const { t } = useTranslation();
  const yupSchema = useMemo(() => {
    return Yup.object({
      password: Yup.string().required(
        t('page.createPassword.passwordRequired'),
      ),
      // .min(8, t('page.createPassword.passwordMin')),
    });
  }, [t]);

  const initialValues = { password: '' };
  const formik = useFormik({
    initialValues,
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnBlur: true,
    // nothing to do, just type guard
    onSubmit: () => void 0,
  });

  const shouldDisabledDueToForm =
    !formik.values.password || !!getFormikErrorsCount(formik.errors);

  return { formik, shouldDisabledDueToForm };
}

export function ModalConfirmAllowTransfer({
  toAddr,
  visible,
  showAddToWhitelist = false,
  onFinished,
  onCancel,
}: ConfirmAllowTransferModalProps & {
  visible: boolean;
}) {
  const { t } = useTranslation();

  const { colors, styles } = useThemeStyles(getStyles);

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const [confirmToAddToWhitelist, setConfirmToAddToWhitelist] = useState(false);

  useEffect(() => {
    toggleShowSheetModal(visible || 'destroy');

    setConfirmToAddToWhitelist(false);
  }, [toggleShowSheetModal, visible]);

  const { addWhitelist } = useWhitelist({
    disableAutoFetch: true,
  });

  const { isUseCustomPwd, isUseBuiltinPwd } = useLoadLockInfo({
    autoFetch: true,
  });
  const { formik, shouldDisabledDueToForm } = useConfirmAllowForm();

  const handleCancel = useCallback(() => {
    onCancel?.();
    formik.resetForm();
  }, [onCancel, formik]);

  const onValidatedPassword = useCallback(
    async (validatedPassword: string) => {
      await apisLock.throwErrorIfInvalidPwd(validatedPassword);

      if (toAddr && confirmToAddToWhitelist) {
        await addWhitelist(toAddr, { hasValidated: isUseCustomPwd });
      }

      onFinished?.({ isAddToWhitelist: confirmToAddToWhitelist });
    },
    [isUseCustomPwd, toAddr, confirmToAddToWhitelist, addWhitelist, onFinished],
  );

  const handleSubmitForm = useCallback<
    React.ComponentProps<typeof BottomSheetModalConfirmContainer>['onConfirm'] &
      object
  >(async () => {
    // only validate password when using custom password
    if (isUseCustomPwd) {
      const errors = await formik.validateForm();

      if (getFormikErrorsCount(errors)) return false;

      try {
        await onValidatedPassword(formik.values.password);
      } catch (error: any) {
        formik.setFieldError('password', error?.message);
        toast.show(error?.message);
        return false;
      }
    } else if (isUseBuiltinPwd) {
      if (toAddr && confirmToAddToWhitelist) {
        await addWhitelist(toAddr, { hasValidated: true });
      }
      onFinished?.({ isAddToWhitelist: confirmToAddToWhitelist });
    }
  }, [
    isUseCustomPwd,
    isUseBuiltinPwd,
    formik,
    onValidatedPassword,
    toAddr,
    confirmToAddToWhitelist,
    onFinished,
    addWhitelist,
  ]);

  const {
    currentAuthType,
    updateAuthType,
    isBiometricsActive,
    handleAuthWithBiometrics,
    prepareBioAuth,
  } = useAuthenticationModal({
    authTypes: ['biometrics', 'password'],
  });
  const shouldShowInput = currentAuthType === 'password' && isUseCustomPwd;
  const shouldDisabled =
    currentAuthType === 'password'
      ? isUseCustomPwd && shouldDisabledDueToForm
      : false;

  const handleConfirm = useCallback(async () => {
    if (currentAuthType === 'biometrics') {
      prepareBioAuth();
      setTimeout(() => {
        handleAuthWithBiometrics().then(result => {
          if (!result.success) {
            updateAuthType('password');
            return;
          }

          onValidatedPassword(result.getValidatedPassword());
        });
      }, 100);

      return false;
    } else {
      return handleSubmitForm();
    }
  }, [
    currentAuthType,
    prepareBioAuth,
    updateAuthType,
    handleAuthWithBiometrics,
    onValidatedPassword,
    handleSubmitForm,
  ]);

  const previousVisible = usePrevious(visible);
  React.useEffect(() => {
    // sometimes, useEffect woule be re-triggered on every re-render
    // only update auth type when visible changed from
    if (!previousVisible && visible) {
      updateAuthType('biometrics');
    }
  }, [previousVisible, visible, updateAuthType]);

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      return !visible;
    }, [visible]),
  );
  useFocusEffect(onHardwareBackHandler);

  return (
    <BottomSheetModalConfirmContainer
      ref={sheetModalRef}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      height={shouldShowInput ? 332 : 279}
      confirmButtonProps={{
        type: 'primary',
        disabled: shouldDisabled,
        title: ctx => (
          <View style={styles.confirmModalButtonTitleViewStyle}>
            {currentAuthType !== 'biometrics' ? null : (
              <BiometricsIcon
                size={18}
                style={{ marginRight: 6 }}
                color={ctx.titleStyle?.color}
              />
            )}
            <Text style={[ctx.titleStyle, styles.confirmModalButtonTextStyle]}>
              {t('global.confirm')}
            </Text>
          </View>
        ),
        containerStyle: styles.confirmModalContainerStyle,
        buttonStyle: styles.confirmModalButtonStyle,
      }}
      bottomSheetModalProps={{
        keyboardBehavior: 'interactive',
        keyboardBlurBehavior: 'restore',
      }}>
      <View style={styles.mainContainer}>
        <Text style={styles.title}>
          {t('page.sendToken.allowTransferModal.title')}
        </Text>

        <View style={styles.contentContainer}>
          <View style={styles.formInputContainer}>
            {shouldShowInput && (
              <FormInput
                clearable
                errorText={formik.errors.password}
                fieldErrorContainerStyle={styles.fieldErrorContainerStyle}
                as={'BottomSheetTextInput'}
                style={styles.inputContainer}
                inputStyle={styles.input}
                inputProps={{
                  value: formik.values.password,
                  onChangeText: text => {
                    formik.setFieldError('password', undefined);
                    formik.setFieldValue('password', text);
                  },
                  placeholder: t(
                    'page.sendToken.allowTransferModal.placeholder',
                  ),
                  placeholderTextColor: colors['neutral-foot'],
                  secureTextEntry: true,
                }}
              />
            )}
          </View>
          {showAddToWhitelist && (
            <TouchableView
              style={styles.confirmTextBtn}
              onPress={() => {
                setConfirmToAddToWhitelist(prev => !prev);
              }}>
              <ThemeIcon
                src={
                  confirmToAddToWhitelist
                    ? RcIconCheckedFilledCC
                    : RcIconUnCheckCC
                }
                style={styles.checkboxIcon}
                color={
                  confirmToAddToWhitelist
                    ? colors['blue-default']
                    : colors['neutral-title1']
                }
              />
              <Text style={styles.checkTitle}>
                {t('page.sendToken.allowTransferModal.addWhitelist')}
              </Text>
            </TouchableView>
          )}
        </View>
      </View>
    </BottomSheetModalConfirmContainer>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    mainContainer: {
      height: '100%',
      width: '100%',
      alignItems: 'center',
    },
    contentContainer: {
      width: '100%',
      height: '100%',
      flexShrink: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      // ...makeDebugBorder()
    },
    formInputContainer: {
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    inputContainer: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card2'],

      height: 52,
    },
    input: {
      fontSize: 14,
    },
    fieldErrorContainerStyle: {
      marginTop: 8,
    },
    title: {
      color: colors['neutral-title1'],
      textAlign: 'center',
      fontSize: 24,
      fontStyle: 'normal',
      fontWeight: '500',
    },
    confirmTextBtn: {
      // marginTop: 24,
      flexDirection: 'row',
      position: 'relative',
      alignItems: 'center',
      paddingLeft: 20,
      paddingVertical: 4,

      marginHorizontal: 'auto',
    },
    checkboxIcon: {
      position: 'absolute',
      top: 6,
      width: 16,
      height: 16,
    },
    checkTitle: {
      color: colors['neutral-title1'],
    },
    confirmModalContainerStyle: {
      // ...(IS_IOS && {
      //   ...makeDebugBorder('red'),
      //   // width: '100%',
      //   // paddingHorizontal: 0,
      // }),
    },
    confirmModalButtonStyle: {
      // ...(IS_IOS && {
      //   ...makeDebugBorder('yellow'),
      //   // width: '100%',
      //   // flex: 1,
      // }),
    },
    confirmModalButtonTitleViewStyle: {
      flex: 0,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    },
    confirmModalButtonTextStyle: {
      flex: 0,
    },
  };
});
