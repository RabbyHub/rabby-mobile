import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import * as Yup from 'yup';

import { default as RcRabbyLogo } from './icons/rabby-logo.svg';
import { Button } from '@/components';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { FormInput } from '@/components/Form/Input';
import { useTranslation } from 'react-i18next';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import TouchableView, {
  SilentTouchableView,
} from '@/components/Touchable/TouchableView';
import { useFormik } from 'formik';
import { toast, toastWithIcon } from '@/components/Toast';
import { apisKeychain, apisLock } from '@/core/apis';
import {
  resetNavigationToHome,
  usePreventGoBack,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { getFormikErrorsCount } from '@/utils/patch';
import { useFocusEffect } from '@react-navigation/native';
import { APP_TEST_PWD } from '@/constant';
import { RequestGenericPurpose } from '@/core/apis/keychain';
import { useUnlockApp } from './hooks';
import { RcIconFaceId, RcIconFingerprint } from './icons';
import { useBiometricsInfo } from '@/hooks/biometrics';
import TouchableText from '@/components/Touchable/TouchableText';

const LAYOUTS = {
  footerButtonHeight: 52,
  containerPadding: 20,
};

const STOP_REDIRECT_TO_HOME_ON_UNLOCKED_ON_DEV = false;

const INIT_DATA = { password: __DEV__ ? (APP_TEST_PWD as string) : '' };
function useUnlockForm(navigation: ReturnType<typeof useRabbyAppNavigation>) {
  const { t } = useTranslation();
  const yupSchema = React.useMemo(() => {
    return Yup.object({
      password: Yup.string().required(t('page.unlock.password.required')),
    });
  }, [t]);
  const { isUnlocking, unlockApp, afterLeaveFromUnlock } = useUnlockApp();

  const checkUnlocked = useCallback(() => {
    if (!apisLock.isUnlocked()) return;

    resetNavigationToHome(navigation);
    afterLeaveFromUnlock();
  }, [navigation, afterLeaveFromUnlock]);

  const formik = useFormik({
    initialValues: INIT_DATA,
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnBlur: true,
    onSubmit: async (values, helpers) => {
      let errors = await helpers.validateForm();

      if (getFormikErrorsCount(errors)) return;

      const result = await unlockApp(values.password, { showLoading: true });
      if (result.error) {
        helpers?.setFieldError('password', t('page.unlock.password.error'));
        toast.show(result.error);
      }
      checkUnlocked();
    },
  });

  const shouldDisabled = isUnlocking || !formik.values.password;

  return { formik, shouldDisabled, checkUnlocked };
}

export default function UnlockScreen() {
  const { styles, colors } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const navigation = useRabbyAppNavigation();
  const { formik, shouldDisabled, checkUnlocked } = useUnlockForm(navigation);
  const { isBiometricsEnabled, supportedBiometryType } = useBiometricsInfo();
  const { unlockApp } = useUnlockApp();

  const [usingBiometrics, setUsingBiometrics] = useState(isBiometricsEnabled);
  const couldSwitchingAuthentication =
    isBiometricsEnabled && !!supportedBiometryType;
  const usePassword = !usingBiometrics || !isBiometricsEnabled;

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPaddingBottom: 0,
    footerHeight: LAYOUTS.footerButtonHeight,
    nextButtonContainerHeight: LAYOUTS.footerButtonHeight,
  });

  const passwordInputRef = React.useRef<TextInput>(null);
  const { onTouchInputAway } = useInputBlurOnTouchaway(passwordInputRef);

  const unlockWithBiometrics = useCallback(async () => {
    try {
      await apisKeychain.requestGenericPassword({
        purpose: RequestGenericPurpose.DECRYPT_PWD,
        onPlainPassword: async password => {
          const result = await unlockApp(password, { showLoading: false });
          if (result.error) {
            throw new Error(result.error);
          }
        },
      });
    } catch (error: any) {
      if (__DEV__) console.error(error);
      if (error.code == 'E_CRYPTO_FAILED') {
        // maybe means user cancelled
        toast.info(t('page.unlock.biometrics.cancelled'));
      } else {
        toast.show(error?.message);
      }
    }
  }, [unlockApp, t]);

  const onPressBiometricsButton = useCallback(async () => {
    await unlockWithBiometrics().finally(() => checkUnlocked());
  }, [unlockWithBiometrics, checkUnlocked]);

  useLayoutEffect(() => {
    if (__DEV__ && STOP_REDIRECT_TO_HOME_ON_UNLOCKED_ON_DEV) {
      console.debug('UnlockScreen::useLayoutEffect skipped on DEV mode.');
      return;
    }

    checkUnlocked();
    (async () => {
      // if (!hasLeftFromUnlock && isAuthenticatedByBiometrics()) {
      //   await unlockWithBiometrics();
      // }
      // checkUnlocked();
    })();
  }, [/* hasLeftFromUnlock, unlockWithBiometrics, */ checkUnlocked]);

  const { registerPreventEffect } = usePreventGoBack({
    navigation,
    shouldGoback: useCallback(() => apisLock.isUnlocked(), []),
  });

  useFocusEffect(registerPreventEffect);

  return (
    <SilentTouchableView
      style={{ height: '100%', flex: 1 }}
      viewProps={{
        style: [
          styles.container,
          { paddingBottom: safeSizes.containerPaddingBottom },
        ],
      }}
      onPress={onTouchInputAway}>
      <View style={styles.topContainer}>
        <RcRabbyLogo style={{ width: 100, height: 100 }} />
        <Text style={styles.title1}>Rabby Wallet</Text>
      </View>
      <View style={styles.bodyContainer}>
        {usePassword ? (
          <View style={styles.formWrapper}>
            <FormInput
              clearable
              ref={passwordInputRef}
              style={styles.inputContainer}
              inputStyle={styles.input}
              errorText={formik.errors.password}
              inputProps={{
                value: formik.values.password,
                secureTextEntry: true,
                inputMode: 'text',
                returnKeyType: 'done',
                placeholder: t('page.unlock.password.placeholder'),
                placeholderTextColor: colors['neutral-foot'],
                onChangeText(text) {
                  // const nextErrors = { ...formik.errors };
                  // delete nextErrors.password;
                  // formik.setErrors(nextErrors);
                  formik.setFieldError('password', undefined);
                  formik.setFieldValue('password', text);
                },
              }}
            />
            <View
              style={[
                styles.unlockButtonWrapper,
                { height: safeSizes.footerHeight },
              ]}>
              <Button
                disabled={shouldDisabled}
                type="primary"
                buttonStyle={[styles.buttonShadow]}
                containerStyle={[
                  styles.nextButtonContainer,
                  { height: safeSizes.nextButtonContainerHeight },
                ]}
                title={'Next'}
                onPress={evt => {
                  evt.stopPropagation();
                  formik.handleSubmit();
                  checkUnlocked();
                }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.biometricsWrapper}>
            <View style={styles.biometricsBtns}>
              <TouchableView
                style={styles.biometricsBtn}
                onPress={onPressBiometricsButton}>
                <RcIconFingerprint width={40} height={40} />
              </TouchableView>
              {/* <TouchableView
                style={styles.biometricsBtn}
                onPress={onPressBiometricsButton}>
                <RcIconFaceId width={40} height={40} />
              </TouchableView> */}
            </View>
          </View>
        )}

        {couldSwitchingAuthentication && (
          <View style={styles.switchingAuthTypeButtonWrapper}>
            <TouchableText
              disabled={shouldDisabled}
              style={styles.switchingAuthTypeButton}
              onPress={() => {
                setUsingBiometrics(prev => !prev);
              }}>
              {usingBiometrics
                ? t('page.unlock.btn.switchtype_pwd')
                : t('page.unlock.btn.switchtype_fingerprint')}
            </TouchableText>
          </View>
        )}
      </View>
    </SilentTouchableView>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      height: '100%',
      backgroundColor: colors['neutral-bg1'],
      justifyContent: 'center',
    },
    topContainer: {
      backgroundColor: 'transparent',
      paddingBottom: 100,
      width: '100%',
      height:
        150 /* min paddingTop */ + 100 /* height */ + 100 /* paddingBottom */,
      // height: '100%',
      flexShrink: 0,
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'center',
      padding: 0,
    },
    title1: {
      color: colors['blue-default'],
      fontSize: 24,
      fontWeight: '700',
      marginTop: 13,
    },
    bodyContainer: {
      flexShrink: 0,
      height: '50%',
      paddingHorizontal: 0,
      paddingTop: 32,
      paddingBottom: 24,
      backgroundColor: colors['neutral-bg1'],
      justifyContent: 'space-between',
      // ...makeDebugBorder(),
    },
    formWrapper: {
      width: '100%',
      paddingHorizontal: LAYOUTS.containerPadding,
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },

    inputContainer: {
      borderRadius: 8,
      height: 64,
    },
    input: {
      backgroundColor: colors['neutral-card1'],
      height: '100%',
      fontSize: 14,
    },
    formFieldError: {
      marginTop: 12,
    },
    formFieldErrorText: {
      color: colors['red-default'],
      fontSize: 14,
      fontWeight: '400',
      textAlign: 'center',
    },

    unlockButtonWrapper: {
      marginTop: 60,
      height: LAYOUTS.footerButtonHeight,
      width: '100%',
      paddingHorizontal: 0,
    },
    nextButtonContainer: {
      width: '100%',
      height: LAYOUTS.footerButtonHeight,
    },
    buttonShadow: {
      // boxShadow: '0px 4px 16px 0px rgba(112, 132, 255, 0.30)',
      shadowColor: 'rgba(112, 132, 255, 0.30)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
    },

    biometricsWrapper: {
      width: '100%',
      paddingHorizontal: LAYOUTS.containerPadding,
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      // ...makeDebugBorder('yellow'),
    },

    biometricsBtns: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    },
    biometricsBtn: {
      width: 40,
      height: 40,
    },
    switchingAuthTypeButtonWrapper: {
      width: '100%',
      // marginTop: 60,
      alignItems: 'center',
    },
    switchingAuthTypeButton: {
      color: colors['blue-default'],
      fontSize: 16,
      fontWeight: '400',
    },
  };
});
