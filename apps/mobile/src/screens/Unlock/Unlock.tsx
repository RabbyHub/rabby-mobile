import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  TextInput,
  Platform,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import * as Yup from 'yup';

import { default as RcRabbyLogoLight } from './icons/icon-with-logo-light.svg';
import { default as RcRabbyLogoDark } from './icons/icon-with-logo-dark.svg';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useTranslation } from 'react-i18next';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import TouchableView, {
  SilentTouchableView,
} from '@/components/Touchable/TouchableView';
import { useFormik } from 'formik';
import { toast, toastWithIcon } from '@/components/Toast';
import { apisAccount, apisKeychain, apisLock } from '@/core/apis';
import {
  resetNavigationTo,
  usePreventGoBack,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { getFormikErrorsCount } from '@/utils/patch';
import { useFocusEffect } from '@react-navigation/native';
import { APP_TEST_PWD, APP_VERSIONS, APPLICATION_ID } from '@/constant';
import {
  RequestGenericPurpose,
  parseKeychainError,
} from '@/core/apis/keychain';
import {
  storeApisUnlock,
  useTipedUserEnableBiometrics,
  useUnlockApp,
} from './hooks';
import { RcIconFaceId, RcIconFingerprint, RcIconInfoForToast } from './icons';
import { storeApisBiometrics, useBiometrics } from '@/hooks/biometrics';
import TouchableText from '@/components/Touchable/TouchableText';
import { sleep } from '@/utils/async';
import { updateUnlockTime } from '@/core/apis/lock';
import { Button } from '@/components2024/Button';
import { NextInput } from '@/components2024/Form/Input';
import YesIcon from '@/assets2024/icons/common/check.svg';
import i18next from 'i18next';
import { RootNames } from '@/constant/layout';
import { measureTime } from '@/core/utils/statics';
import { stats } from '@/utils/stats';
import DeviceInfo from 'react-native-device-info';
import { getAddressesForReport } from '@/core/apis/address';

function runTryCatch<T extends (...args: any[]) => any>(
  fn: T,
): ReturnType<T> | null {
  try {
    return fn();
  } catch (error) {
    console.error('Error occurred:', error);
    return null;
  }
}
async function reportUnlockTime(
  timsMs: number,
  unlockType: 'password' | 'biometrics',
) {
  stats.report('unlockTime', {
    unlock_type: unlockType,
    duration: timsMs,
    os_version: DeviceInfo.getSystemVersion(),
    os_name: DeviceInfo.getSystemName(),
    app_ver: APP_VERSIONS.forFeedback,
    app_id: APPLICATION_ID,
    callable_addr_count:
      (await runTryCatch(
        async () =>
          await getAddressesForReport().then(res => res.myCallableAddressCount),
      )) || 0,
  });
}

const LAYOUTS = {
  footerButtonHeight: 52,
  containerPadding: 20,
};

const isIOS = Platform.OS === 'ios';
const BiometricsIconSize = 76;

const prevFailedRef = { hide: null as (() => void) | null };
const toastFailed = toastWithIcon(RcIconInfoForToast);
const toastBiometricsFailed = (message?: string) => {
  prevFailedRef.hide?.();
  prevFailedRef.hide = toastFailed(message);
};
const toastLoading = toastWithIcon(() => (
  <ActivityIndicator style={{ marginRight: 6 }} />
));
const toastUnlocking = () =>
  toastLoading(i18next.t('page.unlock.unlocking'), { duration: 3000 });

export function BiometricsIcon(props: { isFaceID?: boolean; size?: number }) {
  const { isFaceID = isIOS, size = BiometricsIconSize } = props;

  return isFaceID ? (
    <RcIconFaceId strokeWidth={2} width={size} height={size} />
  ) : (
    <RcIconFingerprint width={size} height={size} />
  );
}

const unlockOnceRef = { current: false };
const INIT_DATA = { password: __DEV__ ? (APP_TEST_PWD as string) : '' };
function useUnlockForm(navigation: ReturnType<typeof useRabbyAppNavigation>) {
  const { t } = useTranslation();
  const yupSchema = React.useMemo(() => {
    return Yup.object({
      password: Yup.string().required(t('page.unlock.password.required')),
    });
  }, [t]);
  const { isUnlocking } = useUnlockApp();

  const checkUnlocked = useCallback(async () => {
    if (!apisLock.isUnlocked()) return;

    const hasUnlockOnce = unlockOnceRef.current;

    const hasAccountsInKeyring = await apisAccount.hasVisibleAccounts();
    requestAnimationFrame(() => {
      resetNavigationTo(
        navigation,
        !hasAccountsInKeyring && !hasUnlockOnce
          ? RootNames.GetStartedScreen2024
          : RootNames.Home,
      );
    });
    unlockOnceRef.current = true;

    storeApisUnlock.afterLeaveFromUnlock();
  }, [navigation]);

  const { tipEnableBiometrics } = useTipedUserEnableBiometrics();

  const formik = useFormik({
    initialValues: INIT_DATA,
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnBlur: true,
    onSubmit: async (values, helpers) => {
      let errors = await helpers.validateForm();

      if (getFormikErrorsCount(errors)) return;

      const { needAlert } = await tipEnableBiometrics(values.password);
      console.debug('needAlert', needAlert);
      const hideToast = needAlert ? null : toastUnlocking();
      try {
        measureTime.start('UnlockWithPassword');
        const result = await storeApisUnlock.unlockApp(values.password);
        const timeResult = measureTime.end('UnlockWithPassword');
        reportUnlockTime(timeResult.diff, 'password');

        if (result.error) {
          helpers?.setFieldError(
            'password',
            result.formFieldError || t('page.unlock.password.error'),
          );
          toast.show(result.toastError || result.error);
        } else {
          updateUnlockTime();
        }
      } catch (error) {
        console.error(error);
      } finally {
        checkUnlocked();
        hideToast?.();
      }
    },
  });

  const shouldDisabled = !formik.values.password;

  return { isUnlocking, formik, shouldDisabled, checkUnlocked };
}

const unlockFailedRef = { current: 0 };
function incToReset(isOnMount = false) {
  // // always reset to 0 on production
  // if (!__DEV__) return 0;

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
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const RcRabbyLogo = isLight ? RcRabbyLogoLight : RcRabbyLogoDark;
  const navigation = useRabbyAppNavigation();
  const {
    computed: { isBiometricsEnabled, isFaceID },
  } = useBiometrics({ autoFetch: true });
  const { isUnlocking, formik, shouldDisabled, checkUnlocked } =
    useUnlockForm(navigation);

  useFocusEffect(
    useCallback(() => {
      storeApisBiometrics.fetchBiometrics();
    }, []),
  );

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
          measureTime.start('UnlockWithBiometrics');
          const result = await storeApisUnlock.unlockApp(password);
          const timeResult = measureTime.end('UnlockWithBiometrics');
          reportUnlockTime(timeResult.diff, 'biometrics');

          if (result.error) {
            throw new Error(result.error);
          }
        },
      });
      updateUnlockTime();
    } catch (error: any) {
      if (__DEV__) console.error(error);

      if (__DEV__ && incToReset() === 0) {
        toastBiometricsFailed(t('page.unlock.biometrics.usePassword'));
        setUsingBiometrics(false);
        storeApisBiometrics.toggleBiometrics(false, {});
      } else if (error.code === 'NIL_KEYCHAIN_OBJECT') {
        toastBiometricsFailed(t('page.unlock.biometrics.usePassword'));
        setUsingBiometrics(false);
        storeApisBiometrics.toggleBiometrics(false, {});
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
  }, [t]);

  const lockBiometricRef = React.useRef(false);
  const manualUnlockWithBiometrics = useCallback(async () => {
    if (lockBiometricRef.current) {
      return;
    }
    lockBiometricRef.current = true;
    if (!isFaceID) {
      const hideToast = toastUnlocking();
      await unlockWithBiometrics().finally(() => {
        checkUnlocked();
        lockBiometricRef.current = false;
      });
      hideToast();
    } else {
      await unlockWithBiometrics().finally(() => {
        checkUnlocked();
        lockBiometricRef.current = false;
      });
    }
  }, [isFaceID, unlockWithBiometrics, checkUnlocked]);

  useLayoutEffect(() => {
    incToReset(true);
    (async () => {
      // wait screen rendered
      await sleep(500);
      if (!isBiometricsEnabled) return;

      await manualUnlockWithBiometrics();
    })();
  }, [isBiometricsEnabled, manualUnlockWithBiometrics]);

  const { registerPreventEffect } = usePreventGoBack({
    navigation,
    shouldGoback: useCallback(() => apisLock.isUnlocked(), []),
  });

  useFocusEffect(registerPreventEffect);

  return (
    <SilentTouchableView
      style={{ height: '100%', flex: 1 }}
      viewProps={{
        style: styles.container,
      }}
      onPress={() => {
        Keyboard.dismiss();
        onTouchInputAway();
      }}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.innerContainer}
        keyboardVerticalOffset={-80}>
        <View style={styles.topContainer}>
          <RcRabbyLogo style={styles.logo} width={125} height={134} />
        </View>
        <View style={styles.bodyContainer}>
          {usingPassword ? (
            <View style={styles.formWrapper}>
              <NextInput.Password
                clearable
                ref={passwordInputRef}
                fieldName={t('page.unlock.password.placeholder')}
                style={styles.inputContainer}
                inputStyle={styles.input}
                iconColor={colors2024['neutral-title-1']}
                inputProps={{
                  value: formik.values.password,
                  secureTextEntry: true,
                  inputMode: 'text',
                  returnKeyType: 'done',
                  placeholderTextColor: colors2024['neutral-foot'],
                  onChangeText(text) {
                    formik.setFieldError('password', undefined);
                    formik.setFieldValue('password', text);
                  },
                }}
                hasError={Boolean(formik.errors.password)}
                tipText={formik.errors.password}
                tipIcon={
                  !formik.errors.password &&
                  formik.values.password && <YesIcon width={12} height={12} />
                }
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
                  onPress={manualUnlockWithBiometrics}>
                  <BiometricsIcon isFaceID={isFaceID} />
                </TouchableView>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    </SilentTouchableView>
  );
}

const getStyles = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      flex: 1,
      height: '100%',
      backgroundColor: colors2024['neutral-bg-1'],
      position: 'relative',
    },
    innerContainer: {
      backgroundColor: colors2024['neutral-bg-1'],
      height: '100%',
      paddingBottom: 0,
      justifyContent: 'space-between',
    },
    topContainer: {
      height: '45%',
      position: 'relative',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    logo: {
      backgroundColor: 'transparent',
      transform: [{ translateX: 0 }, { translateY: 67 }],
    },
    title1: {
      color: isLight
        ? colors2024['neutral-title-1']
        : colors2024['brand-default'],
      fontSize: 22.5,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      marginTop: 13,
    },
    bodyContainer: {
      flexShrink: 1,
      height: '55%',
      justifyContent: 'center',
    },
    formWrapper: {
      width: '100%',
      paddingHorizontal: LAYOUTS.containerPadding,
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },

    inputContainer: {
      borderRadius: 12,
      height: 56,
      backgroundColor: colors2024['neutral-bg-2'],
      borderWidth: 0,
    },
    input: {
      fontSize: 14,
    },
    formFieldError: {
      marginTop: 12,
    },
    formFieldErrorText: {
      color: colors2024['red-default'],
      fontSize: 14,
      fontWeight: '400',
      textAlign: 'center',
    },

    unlockButtonWrapper: {
      marginTop: 20,
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
      marginBottom: 86,
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
      alignItems: 'center',
      position: 'absolute',
      bottom: 56,
    },
    switchingAuthTypeButton: {
      color: colors2024['neutral-foot'],
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
