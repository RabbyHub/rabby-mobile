import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  InteractionManager,
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
import { toast, toastIndicator, toastWithIcon } from '@/components2024/Toast';
import { apisKeychain, apisLock } from '@/core/apis';
import { preferenceService } from '@/core/services';
import {
  UnlockUIManager,
  usePreventGoBack,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { getFormikErrorsCount } from '@/utils/patch';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { APP_TEST_PWD, APP_VERSIONS, APPLICATION_ID } from '@/constant';
import {
  RequestGenericPurpose,
  isBrokenBiometricsEntryError,
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
import { measureTime } from '@/core/utils/statics';
import { stats } from '@/utils/stats';
import DeviceInfo from 'react-native-device-info';
import { getAddressesForReport } from '@/core/apis/address';
import { perfEvents } from '@/core/utils/perf';
import { GetRootScreenRouteProp } from '@/navigation-type';
import { TextInput } from '@/components/Typography';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { startUnlockScreenBootstrapWarmups } from '@/setup-app-before-render';
import { preloadTransactionHotNavigator } from '@/perfs/preloads';
import { logger } from '@/utils/logger';

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
const isAndroid = Platform.OS === 'android';
const BiometricsIconSize = 76;
const UNLOCK_SCREEN_WARMUP_DELAY_MS = 250;
const POST_UNLOCK_WARMUP_DELAY_MS = 800;
const POST_UNLOCK_UI_READY_DELAY_MS = 350;

const unlockWarmupsStateRef = {
  promise: null as Promise<void> | null,
};

function startUnlockWarmups(reason: string) {
  if (unlockWarmupsStateRef.promise) {
    return unlockWarmupsStateRef.promise;
  }

  unlockWarmupsStateRef.promise = Promise.allSettled([
    startUnlockScreenBootstrapWarmups(),
    preloadTransactionHotNavigator(),
  ]).then(results => {
    results.forEach(result => {
      if (result.status === 'rejected') {
        console.error(`startUnlockWarmups::${reason}::error`, result.reason);
      }
    });
  });

  return unlockWarmupsStateRef.promise;
}

function scheduleUnlockWarmupsAfterInteractions(
  reason: string,
  delayMs: number,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const interactionHandle = InteractionManager.runAfterInteractions(() => {
    timeoutId = setTimeout(() => {
      startUnlockWarmups(reason).catch(error => {
        console.error(
          `scheduleUnlockWarmupsAfterInteractions::${reason}`,
          error,
        );
      });
    }, delayMs);
  });

  return () => {
    interactionHandle.cancel?.();
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}

function nextFrame() {
  return new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

function notifyUnlockUIReadyAfterHomePaint() {
  if (!isAndroid) {
    apisLock.notifyUserManuallyUnlockUIReady();
    return;
  }

  traceAndroidUnlockPerf('unlock_ui_ready_notify_deferred_start', {
    delayMs: POST_UNLOCK_UI_READY_DELAY_MS,
  });

  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      traceAndroidUnlockPerf('unlock_ui_ready_notify_deferred_fire');
      apisLock.notifyUserManuallyUnlockUIReady();
    }, POST_UNLOCK_UI_READY_DELAY_MS);
  });
}

const prevFailedRef = { hide: null as (() => void) | null };
const toastFailed = toastWithIcon(RcIconInfoForToast);
const toastBiometricsFailed = (message?: string) => {
  prevFailedRef.hide?.();
  prevFailedRef.hide = toastFailed(message);
};
const toastBiometricsAuthenticating = (isFaceIDAuth: boolean) =>
  toastWithIcon(() => <BiometricsIcon isFaceID={isFaceIDAuth} size={16} />)(
    i18next.t('page.unlock.unlocking'),
    {
      duration: 100000,
      hideOnPress: false,
      position: toast.positions.TOP + 80,
    },
  );
const toastUnlocking = () =>
  toastIndicator(i18next.t('page.unlock.unlocking'), {
    isTop: true,
  });

function traceAndroidUnlockPerf(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (!isAndroid) {
    return;
  }

  logger.info(`[RabbyUnlockPerf:unlock] ${event}`, data);
  console.info('[RabbyUnlockPerf:unlock]', event, data);
}

export function BiometricsIcon(props: { isFaceID?: boolean; size?: number }) {
  const { isFaceID = isIOS, size = BiometricsIconSize } = props;
  const { colors2024 } = useTheme2024();

  return isFaceID ? (
    <RcIconFaceId
      strokeWidth={2}
      width={size}
      height={size}
      color={colors2024['brand-default']}
    />
  ) : (
    <RcIconFingerprint
      width={size}
      height={size}
      color={colors2024['brand-default']}
    />
  );
}

const INIT_DATA = { password: __DEV__ ? (APP_TEST_PWD as string) : '' };
function useUnlockForm(
  navigation: ReturnType<typeof useRabbyAppNavigation>,
  onUnlocked?: () => void,
) {
  const { t } = useTranslation();
  const yupSchema = React.useMemo(() => {
    return Yup.object({
      password: Yup.string().required(t('page.unlock.password.required')),
    });
  }, [t]);
  const { isUnlocking } = useUnlockApp();

  const checkUnlocked = useCallback(async () => {
    if (!apisLock.isUnlocked()) {
      return;
    }

    storeApisUnlock.startLeaveFromUnlock();
    traceAndroidUnlockPerf('unlock_ui_leave_start');

    await new Promise<void>((resolve, reject) => {
      requestAnimationFrame(() => {
        Promise.resolve()
          .then(async () => {
            UnlockUIManager.markUnlockedOnce();
            await UnlockUIManager.resetNavOnUIUnlock();
          })
          .then(resolve, reject);
      });
    });

    await nextFrame();
    storeApisUnlock.afterLeaveFromUnlock();
    traceAndroidUnlockPerf('unlock_ui_leave_end');
    notifyUnlockUIReadyAfterHomePaint();
    onUnlocked?.();
  }, [onUnlocked]);

  const { tipEnableBiometrics } = useTipedUserEnableBiometrics();

  const formik = useFormik({
    initialValues: INIT_DATA,
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnBlur: true,
    onSubmit: async (values, helpers) => {
      let errors = await helpers.validateForm();

      if (getFormikErrorsCount(errors)) {
        return;
      }

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
          await checkUnlocked();
        }
      } catch (error) {
        console.error(error);
        storeApisUnlock.resetUnlocking();
      } finally {
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
  const { params } = useRoute<GetRootScreenRouteProp<'Unlock'>>();
  const {
    computed: { isBiometricsEnabled, isFaceID },
  } = useBiometrics({ autoFetch: true });
  const schedulePostUnlockWarmups = React.useCallback(() => {
    scheduleUnlockWarmupsAfterInteractions(
      'post_unlock',
      POST_UNLOCK_WARMUP_DELAY_MS,
    );
  }, []);
  const { isUnlocking, formik, shouldDisabled, checkUnlocked } = useUnlockForm(
    navigation,
    schedulePostUnlockWarmups,
  );

  useFocusEffect(
    useCallback(() => {
      storeApisBiometrics.fetchBiometrics();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (isBiometricsEnabled && !params?.disableAutoTriggerUnlock) {
        return;
      }

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const frameId = requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          startUnlockWarmups('unlock_screen_focus').catch(error => {
            console.error('startUnlockWarmups::unlock_screen_focus', error);
          });
        }, UNLOCK_SCREEN_WARMUP_DELAY_MS);
      });

      return () => {
        cancelAnimationFrame(frameId);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }, [isBiometricsEnabled, params?.disableAutoTriggerUnlock]),
  );

  const passwordIsAutoGenerated =
    preferenceService.store.passwordIsAutoGenerated;
  const [usingBiometrics, setUsingBiometrics] = useState(
    isBiometricsEnabled || passwordIsAutoGenerated,
  );
  const couldSwitchingAuthentication =
    isBiometricsEnabled && !passwordIsAutoGenerated;
  const usingPassword =
    !usingBiometrics || (!isBiometricsEnabled && !passwordIsAutoGenerated);
  const usingPasswordRef = React.useRef(usingPassword);
  const biometricActionIdRef = React.useRef(0);
  const lockBiometricRef = React.useRef(false);

  React.useEffect(() => {
    usingPasswordRef.current = usingPassword;
  }, [usingPassword]);

  const cancelPendingBiometricUnlock = useCallback(() => {
    biometricActionIdRef.current += 1;
  }, []);

  const isBiometricActionActive = useCallback((actionId: number) => {
    return (
      actionId === biometricActionIdRef.current && !usingPasswordRef.current
    );
  }, []);

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPaddingBottom: 0,
    footerHeight: LAYOUTS.footerButtonHeight,
    nextButtonContainerHeight: LAYOUTS.footerButtonHeight,
  });

  const passwordInputRef = React.useRef<TextInput>(null);
  const { onTouchInputAway } = useInputBlurOnTouchaway(passwordInputRef);

  const unlockWithBiometrics = useCallback(
    async (actionId: number) => {
      if (!isBiometricActionActive(actionId) || apisLock.isUnlocked()) {
        return;
      }

      const startedAt = Date.now();
      const hideAuthToastRef = {
        current: null as null | (() => void),
      };
      const hidePostAuthToastRef = {
        current: null as null | (() => void),
      };

      try {
        traceAndroidUnlockPerf('request_biometrics_start', {
          isFaceID,
        });
        if (isAndroid && !isFaceID) {
          hideAuthToastRef.current = toastBiometricsAuthenticating(isFaceID);
          traceAndroidUnlockPerf('biometrics_auth_toast_show', {
            elapsedMs: Date.now() - startedAt,
          });
        }
        await apisKeychain.requestGenericPassword({
          purpose: RequestGenericPurpose.DECRYPT_PWD,
          shouldAttachTrustedVaultKeyString: !isAndroid,
          onPlainPassword: async (password, credentials) => {
            if (!isBiometricActionActive(actionId)) {
              return;
            }

            traceAndroidUnlockPerf('on_plain_password', {
              elapsedMs: Date.now() - startedAt,
              hasTrustedVaultKeyString: !!credentials?.vaultKeyString,
            });
            hideAuthToastRef.current?.();
            hideAuthToastRef.current = null;
            if (!isFaceID) {
              hidePostAuthToastRef.current = toastUnlocking();
              traceAndroidUnlockPerf('post_auth_unlock_toast_show', {
                elapsedMs: Date.now() - startedAt,
              });
            }
            measureTime.start('UnlockWithBiometrics');
            try {
              traceAndroidUnlockPerf('unlock_app_start', {
                elapsedMs: Date.now() - startedAt,
              });
              const result = await storeApisUnlock.unlockApp(password, {
                trustedPassword: isAndroid,
                trustedVaultKeyString:
                  isAndroid && typeof credentials?.vaultKeyString === 'string'
                    ? credentials.vaultKeyString
                    : undefined,
                deferMemStoreKeyringsUpdate: isAndroid,
                onTrustedVaultKeyString: isAndroid
                  ? vaultKeyString => {
                      if (credentials) {
                        credentials.vaultKeyString = vaultKeyString;
                      }
                      traceAndroidUnlockPerf('cache_trusted_vault_key_string', {
                        elapsedMs: Date.now() - startedAt,
                      });
                      return apisKeychain.cacheTrustedVaultKeyString(
                        password,
                        vaultKeyString,
                      );
                    }
                  : undefined,
              });
              const timeResult = measureTime.end('UnlockWithBiometrics');
              reportUnlockTime(timeResult.diff, 'biometrics');

              traceAndroidUnlockPerf('unlock_app_end', {
                elapsedMs: Date.now() - startedAt,
                unlockMs: timeResult.diff,
                hasError: !!result.error,
              });

              if (result.error) {
                throw new Error(result.error);
              }

              if (!isBiometricActionActive(actionId)) {
                return;
              }

              await checkUnlocked();
              traceAndroidUnlockPerf('check_unlocked_end', {
                elapsedMs: Date.now() - startedAt,
              });
            } finally {
              hidePostAuthToastRef.current?.();
              hidePostAuthToastRef.current = null;
            }
          },
        });
        if (!isBiometricActionActive(actionId)) {
          return;
        }
        traceAndroidUnlockPerf('request_biometrics_end', {
          elapsedMs: Date.now() - startedAt,
        });
        updateUnlockTime();
      } catch (error: any) {
        if (!isBiometricActionActive(actionId)) {
          return;
        }

        traceAndroidUnlockPerf('request_biometrics_error', {
          elapsedMs: Date.now() - startedAt,
          code: error?.code,
          message: error?.message,
        });
        if (__DEV__) {
          console.error(error);
        }

        storeApisUnlock.resetUnlocking();

        if (__DEV__ && incToReset() === 0) {
          if (passwordIsAutoGenerated) {
            toastBiometricsFailed(
              t('page.unlock.biometrics.failedAndTipTitle'),
            );
          } else {
            toastBiometricsFailed(t('page.unlock.biometrics.usePassword'));
            setUsingBiometrics(false);
            storeApisBiometrics.toggleBiometrics(false, {});
          }
        } else if (error.code === 'NIL_KEYCHAIN_OBJECT') {
          if (passwordIsAutoGenerated) {
            toastBiometricsFailed(
              t('page.unlock.biometrics.failedAndTipTitle'),
            );
          } else {
            toastBiometricsFailed(t('page.unlock.biometrics.usePassword'));
            setUsingBiometrics(false);
            storeApisBiometrics.toggleBiometrics(false, {});
          }
        } else if (isBrokenBiometricsEntryError(error)) {
          toastBiometricsFailed(error.message);
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
            [
              'decrypt_fail' /* iOS */,
              'E_CRYPTO_FAILED' /* Android */,
            ].includes(error.code)
          ) {
            const parsedInfo = parseKeychainError(error);
            if (__DEV__ && parsedInfo.sysMessage) {
              parsedInfo.isCancelledByUser
                ? console.warn(parsedInfo.sysMessage)
                : console.error(parsedInfo.sysMessage);
            }
          }
        }
      } finally {
        hideAuthToastRef.current?.();
        hideAuthToastRef.current = null;
        hidePostAuthToastRef.current?.();
        hidePostAuthToastRef.current = null;
      }
    },
    [
      checkUnlocked,
      isBiometricActionActive,
      isFaceID,
      passwordIsAutoGenerated,
      t,
    ],
  );

  const processUnlockWithBiometrics = useCallback(async () => {
    if (
      lockBiometricRef.current ||
      usingPasswordRef.current ||
      apisLock.isUnlocked()
    ) {
      return;
    }
    const actionId = biometricActionIdRef.current + 1;
    biometricActionIdRef.current = actionId;
    lockBiometricRef.current = true;
    const unlockBiometricsIfActive = () => {
      if (!isBiometricActionActive(actionId)) {
        return Promise.resolve();
      }
      return unlockWithBiometrics(actionId);
    };
    const releaseBiometricLock = () => {
      checkUnlocked();
      lockBiometricRef.current = false;
    };

    if (!isFaceID && !isAndroid) {
      const hideToast = toastUnlocking();
      await unlockBiometricsIfActive().finally(() => {
        releaseBiometricLock();
        hideToast();
      });
    } else {
      await unlockBiometricsIfActive().finally(releaseBiometricLock);
    }
  }, [isFaceID, isBiometricActionActive, unlockWithBiometrics, checkUnlocked]);

  useLayoutEffect(() => {
    incToReset(true);
    const sub = perfEvents.subscribe('AUTO_TRIGGER_UNLOCK', async () => {
      const pendingActionId = biometricActionIdRef.current;
      // wait screen rendered
      await sleep(500);
      if (
        pendingActionId !== biometricActionIdRef.current ||
        (!isBiometricsEnabled && !passwordIsAutoGenerated) ||
        usingPasswordRef.current
      ) {
        return;
      }

      await processUnlockWithBiometrics();
    });

    return () => {
      sub.remove();
    };
  }, [
    isBiometricsEnabled,
    processUnlockWithBiometrics,
    passwordIsAutoGenerated,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (params?.disableAutoTriggerUnlock) {
        return;
      }
      UnlockUIManager.triggerAutoUnlock();
    }, [params?.disableAutoTriggerUnlock]),
  );

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
                  ...makeTestIDProps(E2E_ID.unlock.passwordInput),
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
                  {...makeTestIDProps(E2E_ID.unlock.submit)}
                  buttonStyle={[styles.buttonShadow]}
                  containerStyle={[
                    styles.nextButtonContainer,
                    { height: safeSizes.nextButtonContainerHeight },
                  ]}
                  title={t('page.unlock.btn.unlock')}
                  onPress={evt => {
                    evt.stopPropagation();
                    cancelPendingBiometricUnlock();
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
                  onPress={processUnlockWithBiometrics}>
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
            {...makeTestIDProps(
              E2E_ID.unlock.switchAuthType,
              usingBiometrics
                ? E2E_ID.unlock.switchAuthTypePassword
                : E2E_ID.unlock.switchAuthTypeBiometrics,
            )}
            style={styles.switchingAuthTypeButton}
            onPress={() => {
              cancelPendingBiometricUnlock();
              setUsingBiometrics(prev => !prev);
            }}>
            {usingBiometrics
              ? t('page.unlock.btn.switchtype_pwd')
              : isFaceID
              ? t('page.unlock.btn.switchtype_faceid')
              : t('page.unlock.btn.switchtype_fingerprint')}
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
