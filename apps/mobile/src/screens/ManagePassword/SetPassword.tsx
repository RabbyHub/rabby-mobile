import React from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';

import * as Yup from 'yup';
import { useFormik } from 'formik';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { Button } from '@/components';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { FormInput } from '@/components/Form/Input';

import { default as RcPasswordLockCC } from './icons/password-lock-cc.svg';
import { CheckBoxCircled } from '@/components/Icons/Checkbox';
import { getFormikErrorsCount } from '@/utils/patch';
import { toast, toastWithIcon } from '@/components/Toast';
import { apisLock } from '@/core/apis';
import TouchableView, {
  SilentTouchableView,
} from '@/components/Touchable/TouchableView';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import {
  resetNavigationToHome,
  useRabbyAppNavigation,
} from '@/hooks/navigation';

const TEST_PWD = __DEV__ ? '11111111' : '';
const INIT_FORM_DATA = __DEV__
  ? { password: TEST_PWD, confirmPassword: TEST_PWD, checked: false }
  : { password: '', confirmPassword: '', checked: false };

const LAYOUTS = {
  footerButtonHeight: 52,
  fixedFooterPaddingHorizontal: 20,
  fixedFooterPaddingVertical: 20,
  get fixedFooterHeight() {
    return this.footerButtonHeight + this.fixedFooterPaddingVertical * 2;
  },
};

function useSetupPasswordForm() {
  const { t } = useTranslation();
  const yupSchema = React.useMemo(() => {
    return Yup.object({
      password: Yup.string()
        .required(t('page.createPassword.passwordRequired'))
        .min(8, t('page.createPassword.passwordMin')),
      confirmPassword: Yup.string()
        .required(t('page.createPassword.confirmRequired'))
        .oneOf(
          [Yup.ref('password'), ''],
          t('page.createPassword.confirmError'),
        ),
      checked: Yup.boolean().oneOf([true]),
    });
  }, [t]);

  const navigation = useRabbyAppNavigation();

  const formik = useFormik({
    initialValues: INIT_FORM_DATA,
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnBlur: true,
    onSubmit: async (values, helpers) => {
      let errors = await helpers.validateForm();

      if (getFormikErrorsCount(errors)) return;

      const toastHide = toastWithIcon(() => (
        <ActivityIndicator style={{ marginRight: 6 }} />
      ))(`Setting up password`, {
        duration: 1e6,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });

      try {
        const result = await apisLock.setupWalletPassword(values.password);
        if (result.error) {
          toast.show(result.error);
        }
        resetNavigationToHome(navigation);
      } finally {
        toastHide();
      }
    },
  });

  const shouldDisabled =
    !formik.values.checked || !!getFormikErrorsCount(formik.errors);

  return { formik, shouldDisabled };
}

export default function SetPasswordScreen() {
  const { styles, colors } = useThemeStyles(getStyles);
  const { t } = useTranslation();
  const { formik, shouldDisabled } = useSetupPasswordForm();

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPaddingBottom: LAYOUTS.fixedFooterHeight,
    footerHeight: LAYOUTS.fixedFooterHeight,
    nextButtonContainerHeight: LAYOUTS.footerButtonHeight,
  });

  const passwordInputRef = React.useRef<TextInput>(null);
  const confirmPasswordInputRef = React.useRef<TextInput>(null);

  const { onTouchInputAway } = useInputBlurOnTouchaway([
    passwordInputRef,
    confirmPasswordInputRef,
  ]);

  return (
    <SilentTouchableView
      style={{ height: '100%', flex: 1 }}
      viewStyle={[
        styles.container,
        { paddingBottom: safeSizes.containerPaddingBottom },
      ]}
      onPress={onTouchInputAway}>
      <View style={styles.topContainer}>
        <RcPasswordLockCC color={colors['neutral-title2']} />
        <Text style={styles.title1}>{t('page.createPassword.title')}</Text>
        <Text style={styles.title2}>{t('page.createPassword.subTitle')}</Text>
      </View>
      <View style={styles.bodyContainer}>
        <View style={styles.formWrapper}>
          <View style={styles.inputHorizontalGroup}>
            <FormInput
              ref={passwordInputRef}
              style={styles.inputContainer}
              inputStyle={styles.input}
              inputProps={{
                value: formik.values.password,
                secureTextEntry: true,
                inputMode: 'text',
                returnKeyType: 'done',
                placeholder: t('page.createPassword.passwordPlaceholder'),
                placeholderTextColor: colors['neutral-foot'],
                onChangeText(text) {
                  formik.setFieldValue('password', text);
                },
              }}
              errorText={formik.errors.password}
            />

            <FormInput
              ref={confirmPasswordInputRef}
              style={[styles.inputContainer, { marginTop: 20 }]}
              inputStyle={styles.input}
              inputProps={{
                value: formik.values.confirmPassword,
                secureTextEntry: true,
                inputMode: 'text',
                returnKeyType: 'done',
                placeholder: t(
                  'page.createPassword.confirmPasswordPlaceholder',
                ),
                placeholderTextColor: colors['neutral-foot'],
                onChangeText(text) {
                  formik.setFieldValue('confirmPassword', text);
                },
              }}
              errorText={formik.errors.confirmPassword}
            />
          </View>
          <TouchableView
            style={styles.agreementWrapper}
            onPress={() => {
              formik.setFieldValue('checked', !formik.values.checked);
            }}>
            <View>
              <CheckBoxCircled checked={formik.values.checked} />
            </View>

            <Text style={styles.agreementText}>
              <Trans i18nKey="page.createPassword.agree" t={t}>
                I have read and agree to the{' '}
                <Text style={styles.termOfUse}>Term of Use</Text>
              </Trans>
            </Text>
          </TouchableView>
        </View>
      </View>
      <View
        style={[
          styles.fixedFooterContainer,
          { height: safeSizes.footerHeight },
        ]}>
        <Button
          disabled={shouldDisabled}
          type="primary"
          containerStyle={[
            styles.nextButtonContainer,
            { height: safeSizes.nextButtonContainerHeight },
          ]}
          title={'Next'}
          onPress={formik.handleSubmit}
        />
      </View>
    </SilentTouchableView>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      height: '100%',
      backgroundColor: colors['neutral-bg2'],
      paddingBottom: LAYOUTS.fixedFooterHeight,
    },
    topContainer: {
      backgroundColor: colors['blue-default'],
      height: 320,
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      flexShrink: 0,
    },
    title1: {
      color: colors['neutral-title2'],
      fontSize: 24,
      fontWeight: '700',
      marginTop: 8,
    },
    title2: {
      color: colors['neutral-title2'],
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 8,
    },
    bodyContainer: {
      // backgroundColor: colors['neutral-bg2'],
      flexShrink: 1,
      height: '100%',
      paddingHorizontal: 0,
      paddingTop: 32,
      paddingBottom: 24,
      // ...makeDebugBorder()
    },
    formWrapper: {
      width: '100%',
      height: '100%',
      paddingHorizontal: 20,
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    inputHorizontalGroup: {
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },

    inputContainer: {
      borderRadius: 8,
      height: 56,
    },
    input: {
      backgroundColor: colors['neutral-card1'],
      fontSize: 14,
    },

    agreementWrapper: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    agreementText: {
      marginLeft: 6,
      color: colors['neutral-body'],
    },
    termOfUse: {
      color: colors['blue-default'],
    },

    fixedFooterContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors['neutral-bg2'],
      height: LAYOUTS.fixedFooterHeight,
      paddingVertical: LAYOUTS.fixedFooterPaddingVertical,
      paddingHorizontal: LAYOUTS.fixedFooterPaddingHorizontal,
      borderTopWidth: 1,
      borderTopColor: colors['neutral-line'],
    },
    nextButtonContainer: {
      width: '100%',
      height: LAYOUTS.footerButtonHeight,
    },
  };
});
