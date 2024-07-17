import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
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
  resetNavigationTo,
  usePreventGoBack,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { getFormikErrorsCount } from '@/utils/patch';
import { useFocusEffect } from '@react-navigation/native';
import { APP_TEST_PWD } from '@/constant';
import {
  RequestGenericPurpose,
  parseKeychainError,
} from '@/core/apis/keychain';
import { useUnlockApp } from './hooks';
import { RcIconFaceId, RcIconFingerprint, RcIconInfoForToast } from './icons';
import { useBiometrics } from '@/hooks/biometrics';
import TouchableText from '@/components/Touchable/TouchableText';
import { sleep } from '@/utils/async';

const LAYOUTS = {
  footerButtonHeight: 52,
  containerPadding: 20,
};

const isIOS = Platform.OS === 'ios';
const BiometricsIconSize = 56;

const hasAutoUnlockByBiometricsRef = { current: false };

const prevFailedRef = { hide: null as (() => void) | null };
const toastFailed = toastWithIcon(RcIconInfoForToast);
const toastBiometricsFailed = (message?: string) => {
  prevFailedRef.hide?.();
  prevFailedRef.hide = toastFailed(message);
};
const toastLoading = toastWithIcon(() => (
  <ActivityIndicator style={{ marginRight: 6 }} />
));
const toastUnlocking = () => toastLoading('Unlocking');

function BiometricsIcon(props: { isFaceID?: boolean }) {
  const { isFaceID = isIOS } = props;

  return isFaceID ? (
    <RcIconFaceId
      strokeWidth={2}
      width={BiometricsIconSize}
      height={BiometricsIconSize}
    />
  ) : (
    <RcIconFingerprint width={BiometricsIconSize} height={BiometricsIconSize} />
  );
}

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

    resetNavigationTo(navigation, 'Home');
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

      const hideToast = toastUnlocking();
      try {
        const result = await unlockApp(values.password);
        if (result.error) {
          helpers?.setFieldError('password', t('page.unlock.password.error'));
          toast.show(result.error);
        }
      } catch (error) {
        console.error(error);
      } finally {
        checkUnlocked();
        hideToast();
        hasAutoUnlockByBiometricsRef.current = true;
      }
    },
  });

  const shouldDisabled = !formik.values.password;

  return { isUnlocking, formik, shouldDisabled, checkUnlocked };
}

const unlockFailedRef = { current: 0 };
function incToReset(isOnMount = false) {
  // always reset to 0 on production
  if (!__DEV__) return 0;

  if (!isOnMount) {
    unlockFailedRef.current += 1;
    if (unlockFailedRef.current >= 3) {
      unlockFailedRef.current = 0;
    }
  } else {
    unlockFailedRef.current = 0;
  }

  return unlockFailedRef.current;
}
export default function UnlockScreen() {
  const { styles, colors } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const navigation = useRabbyAppNavigation();
  const { isUnlocking, formik, shouldDisabled, checkUnlocked } =
    useUnlockForm(navigation);
  const {
    computed: { isBiometricsEnabled, supportedBiometryType, isFaceID },
    fetchBiometrics,
  } = useBiometrics({ autoFetch: true });

  useFocusEffect(
    useCallback(() => {
      fetchBiometrics();
    }, [fetchBiometrics]),
  );

  const { unlockApp } = useUnlockApp();

  const [usingBiometrics, setUsingBiometrics] = useState(isBiometricsEnabled);
  const couldSwitchingAuthentication = isBiometricsEnabled;
  const usingPassword = !usingBiometrics || !isBiometricsEnabled;

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
          const result = await unlockApp(password);
          if (result.error) {
            throw new Error(result.error);
          }
        },
      });
    } catch (error: any) {
      if (__DEV__) console.error(error);

      if (incToReset() === 0) {
        toastBiometricsFailed(t('page.unlock.biometrics.usePassword'));
        setUsingBiometrics(false);
      } else {
        toastBiometricsFailed(t('page.unlock.biometrics.failedAndTipTitle'));
      }

      // leave here for debug
      if (__DEV__) {
        console.debug(
          'error.code: %s; error.name: %s; error.message: %s',
          error.code,
          error.name,
          error.message,
        );

        if (
          ['decrypt_fail' /* iOS */, 'E_CRYPTO_FAILED' /* Android */].includes(
            error.code,
          )
        ) {
          const parsedInfo = parseKeychainError(error);
          if (__DEV__ && parsedInfo.sysMessage) {
            parsedInfo.isCancelledByUser
              ? console.warn(parsedInfo.sysMessage)
              : console.error(parsedInfo.sysMessage);
          }
        }
      }
    }
  }, [unlockApp, t]);

  const triggerUnlockWithBiometrics = useCallback(async () => {
    const hideToast = toastUnlocking();
    await unlockWithBiometrics().finally(() => checkUnlocked());
    hideToast();
  }, [unlockWithBiometrics, checkUnlocked]);

  useLayoutEffect(() => {
    incToReset(true);

    (async () => {
      // wait screen rendered
      await sleep(500);
      if (hasAutoUnlockByBiometricsRef.current) return;
      if (!isBiometricsEnabled) return;

      await triggerUnlockWithBiometrics().finally(() => {
        hasAutoUnlockByBiometricsRef.current = true;
      });
    })();
  }, [isBiometricsEnabled, triggerUnlockWithBiometrics]);

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
        {usingPassword ? (
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
                loading={isUnlocking}
                disabled={shouldDisabled}
                type="primary"
                buttonStyle={[styles.buttonShadow]}
                containerStyle={[
                  styles.nextButtonContainer,
                  { height: safeSizes.nextButtonContainerHeight },
                ]}
                title={t('page.unlock.btn.unlock')}
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
                onPress={triggerUnlockWithBiometrics}>
                <BiometricsIcon isFaceID={isFaceID} />
              </TouchableView>
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
                : Platform.select({
                    ios: t('page.unlock.btn.switchtype_faceid'),
                    android: t('page.unlock.btn.switchtype_fingerprint'),
                  }) || t('page.unlock.btn.switchtype_fingerprint')}
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
      // ...makeDebugBorder('yellow'),
    },
    biometricsBtn: {
      width: BiometricsIconSize,
      height: BiometricsIconSize,
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
      // ...makeDebugBorder('yellow'),
      paddingTop: 12,
      paddingBottom: 4,
      paddingHorizontal: 10,
    },
  };
});
