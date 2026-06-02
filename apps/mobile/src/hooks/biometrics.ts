import { useCallback, useEffect, useMemo } from 'react';
import { BIOMETRY_TYPE } from '@rabby-wallet/react-native-keychain';
import { toast, toastLoading } from '@/components2024/Toast';
import { apisKeychain } from '@/core/apis';
import {
  KEYCHAIN_AUTH_TYPES,
  RequestGenericPurpose,
  getAuthenticationType,
  isAuthenticatedByBiometrics,
  parseKeychainError,
  type KeychainDebugState,
  type KeychainSupportedBiometryType,
} from '@/core/apis/keychain';
import { useTranslation } from 'react-i18next';
import {
  ValidationBehaviorProps,
  parseValidationBehavior,
} from '@/core/apis/lock';
import { Alert, Vibration } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { IExtractFromPromise } from '@/utils/type';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { preferenceService } from '@/core/services';
import { zustandByMMKV } from '@/core/storage/mmkv';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';
import { isNonPublicProductionEnv } from '@/constant';

type BiometricsInfoState = {
  authEnabled: boolean;
  supportedBiometryType: KeychainSupportedBiometryType;
  devicePasscodeAvailable: boolean;
};
type BiometricsSystemAuthAvailability = Pick<
  BiometricsInfoState,
  'supportedBiometryType' | 'devicePasscodeAvailable'
>;

export const BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES = {
  REAL: 'real',
  NONE: 'none',
} as const;

export type BiometricsSystemAuthDebugMode =
  (typeof BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES)[keyof typeof BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES];

type BiometricsSystemAuthDebugState = {
  mode: BiometricsSystemAuthDebugMode;
};

const biometricsSystemAuthDebugStore =
  zustandByMMKV<BiometricsSystemAuthDebugState>(
    '@BiometricsSystemAuthDebugSettings',
    {
      mode: BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES.REAL,
    },
  );

const biometricsInfoStore = zCreate<BiometricsInfoState>(() => ({
  authEnabled: isAuthenticatedByBiometrics(),
  supportedBiometryType: null,
  devicePasscodeAvailable: false,
}));
export function setBiometrics(
  valOrFunc: UpdaterOrPartials<BiometricsInfoState>,
) {
  biometricsInfoStore.setState(
    prev => resolveValFromUpdater(prev, valOrFunc).newVal,
  );
}
async function getDevicePasscodeAvailable() {
  if (IS_IOS) {
    return false;
  }

  const [keychainPasscodeAvailable, keyguardSecure] = await Promise.all([
    apisKeychain.isPasscodeAuthAvailable().catch(() => false),
    DeviceInfo.isPinOrFingerprintSet().catch(() => false),
  ]);

  return keychainPasscodeAvailable || keyguardSecure;
}

export function canUseBiometricsSystemAuthDebugMock() {
  return IS_ANDROID && isNonPublicProductionEnv;
}

export function getBiometricsSystemAuthDebugMode() {
  if (!canUseBiometricsSystemAuthDebugMock()) {
    return BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES.REAL;
  }

  const mode = biometricsSystemAuthDebugStore.getState().mode;
  return mode === BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES.NONE
    ? mode
    : BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES.REAL;
}

export function setBiometricsSystemAuthDebugMode(
  nextMode: BiometricsSystemAuthDebugMode,
) {
  if (!canUseBiometricsSystemAuthDebugMock()) {
    return false;
  }

  biometricsSystemAuthDebugStore.setState(prev => ({
    ...prev,
    mode: nextMode,
  }));
  return true;
}

export function applyBiometricsSystemAuthDebugMock(
  systemAuth: BiometricsSystemAuthAvailability,
  mode: BiometricsSystemAuthDebugMode = getBiometricsSystemAuthDebugMode(),
): BiometricsSystemAuthAvailability {
  switch (mode) {
    case BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES.NONE:
      return {
        supportedBiometryType: null,
        devicePasscodeAvailable: false,
      };
    case BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES.REAL:
    default:
      return systemAuth;
  }
}

export function useBiometricsSystemAuthDebugMock() {
  const rawMode = biometricsSystemAuthDebugStore(s => s.mode);
  const canUse = canUseBiometricsSystemAuthDebugMock();
  const mode =
    canUse && rawMode === BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES.NONE
      ? rawMode
      : BIOMETRICS_SYSTEM_AUTH_DEBUG_MODES.REAL;
  const setMode = useCallback(
    (nextMode: BiometricsSystemAuthDebugMode) =>
      setBiometricsSystemAuthDebugMode(nextMode),
    [],
  );

  return {
    canUse,
    mode,
    setMode,
  };
}

async function fetchSystemAuthAvailability() {
  const [supportedBiometryType, devicePasscodeAvailable] = await Promise.all([
    apisKeychain.getSupportedBiometryType().catch(() => null),
    getDevicePasscodeAvailable(),
  ]);

  return applyBiometricsSystemAuthDebugMock({
    supportedBiometryType,
    devicePasscodeAvailable,
  });
}

runIIFEFunc(() => {
  fetchSystemAuthAvailability().then(systemAuth => {
    setBiometrics(prev => ({ ...prev, ...systemAuth }));
  });
});

function isPrimaryAndroidBiometricsEntryReady(state: KeychainDebugState) {
  if (state.platform !== 'android' || !state.debugSupported) {
    return true;
  }

  return state.hasEntry && state.hasUsername && state.hasPassword;
}

async function checkAndroidBiometricsEntryReady() {
  if (!IS_ANDROID || !isAuthenticatedByBiometrics()) {
    return true;
  }

  try {
    const debugState = await apisKeychain.getKeychainDebugState();
    const ready = isPrimaryAndroidBiometricsEntryReady(debugState);

    if (!ready) {
      logger.warn('[biometrics] Android keychain entry is unavailable', {
        sourceLabel: debugState.sourceLabel,
        hasEntry: debugState.hasEntry,
        hasUsername: debugState.hasUsername,
        hasPassword: debugState.hasPassword,
        resolvedCipherStorageName:
          debugState.platform === 'android'
            ? debugState.resolvedCipherStorageName
            : undefined,
        hasKeystoreAlias:
          debugState.platform === 'android'
            ? debugState.hasKeystoreAlias
            : undefined,
      });
    }

    return ready;
  } catch (error) {
    logger.warn('[biometrics] failed to inspect Android keychain entry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

export function disableBiometricsForCurrentSession(reason: string) {
  logger.warn('[biometrics] disabled for current session', { reason });
  setBiometrics(prev => ({ ...prev, authEnabled: false }));
}

async function ensureBiometricsReadyForUnlock() {
  let systemAuth = {
    supportedBiometryType: null as KeychainSupportedBiometryType,
    devicePasscodeAvailable: false,
  };
  try {
    systemAuth = await fetchSystemAuthAvailability();
  } catch (error) {
    logger.warn('[biometrics] failed to fetch system auth availability', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const enabledBySetting = isAuthenticatedByBiometrics();
  const entryReady = await checkAndroidBiometricsEntryReady();
  const authType = getAuthenticationType();
  const canUseDevicePasscode =
    !IS_IOS &&
    (authType === KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE ||
      authType === KEYCHAIN_AUTH_TYPES.BIOMETRICS) &&
    systemAuth.devicePasscodeAvailable;
  const nextAuthEnabled =
    enabledBySetting &&
    entryReady &&
    (!!systemAuth.supportedBiometryType || canUseDevicePasscode);

  setBiometrics(prev => ({
    ...prev,
    ...systemAuth,
    supportedBiometryType:
      systemAuth.supportedBiometryType ||
      (!IS_ANDROID && nextAuthEnabled ? prev.supportedBiometryType : null),
    authEnabled: nextAuthEnabled,
  }));

  return nextAuthEnabled;
}

export function computeBiometricsState({
  authEnabled,
  supportedBiometryType,
  devicePasscodeAvailable,
  authType,
  passwordIsAutoGenerated,
  t,
  isIOS = IS_IOS,
}: {
  authEnabled: boolean;
  supportedBiometryType: KeychainSupportedBiometryType;
  devicePasscodeAvailable: boolean;
  authType: KEYCHAIN_AUTH_TYPES;
  passwordIsAutoGenerated: boolean;
  t: (key: string) => string;
  isIOS?: boolean;
}) {
  const isFaceID = supportedBiometryType === BIOMETRY_TYPE.FACE_ID;
  const isBiometricsOrPasscode =
    authType === KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE;
  const canAuthTypeFallbackToDevicePasscode =
    isBiometricsOrPasscode ||
    (!isIOS && authType === KEYCHAIN_AUTH_TYPES.BIOMETRICS);
  const couldSetupSystemAuth =
    !!supportedBiometryType || devicePasscodeAvailable;
  const canFallbackToDevicePasscode =
    authEnabled &&
    canAuthTypeFallbackToDevicePasscode &&
    devicePasscodeAvailable;

  // When biometrics have no permission/enrollment, passcode-capable keychain
  // entries can still rely on the device passcode for authentication.
  const isUsingDevicePasscode =
    !supportedBiometryType &&
    devicePasscodeAvailable &&
    (passwordIsAutoGenerated || canFallbackToDevicePasscode);
  const detectedBiometricsLabel = isFaceID
    ? t('page.setting.faceId')
    : supportedBiometryType && isIOS
    ? t('page.setting.touchId')
    : t('page.setting.fingerPrint');
  const devicePasscodeLabel = t('page.setting.devicePassword');
  const devicePasscodeActionLabel = t('page.setting.useDevicePassword');
  const systemAuthTypeLabel = isUsingDevicePasscode
    ? devicePasscodeLabel
    : detectedBiometricsLabel;
  const systemAuthSettingsLabel = isUsingDevicePasscode
    ? devicePasscodeActionLabel
    : detectedBiometricsLabel;
  const detectedBiometricsSwitchTypeLabel = isFaceID
    ? t('page.unlock.btn.switchtype_faceid')
    : t('page.unlock.btn.switchtype_fingerprint');
  const systemAuthSwitchTypeLabel = isUsingDevicePasscode
    ? devicePasscodeActionLabel
    : detectedBiometricsSwitchTypeLabel;

  return {
    isBiometricsEnabled:
      authEnabled && (!!supportedBiometryType || canFallbackToDevicePasscode),
    settingsAuthEnabled: authEnabled,
    couldSetupBiometrics: !!supportedBiometryType,
    couldSetupSystemAuth,
    supportedBiometryType,
    devicePasscodeAvailable,
    defaultTypeLabel: detectedBiometricsLabel,
    devicePasscodeLabel,
    devicePasscodeActionLabel,
    systemAuthTypeLabel,
    systemAuthSettingsLabel,
    systemAuthSwitchTypeLabel,
    isFaceID,
    isUsingDevicePasscode,
  };
}

export function useBiometricsComputed() {
  const authEnabled = biometricsInfoStore(s => s.authEnabled);
  const supportedBiometryType = biometricsInfoStore(
    s => s.supportedBiometryType,
  );
  const devicePasscodeAvailable = biometricsInfoStore(
    s => s.devicePasscodeAvailable,
  );
  const { t } = useTranslation();

  const computed = useMemo(() => {
    return computeBiometricsState({
      authEnabled,
      supportedBiometryType,
      devicePasscodeAvailable,
      authType: getAuthenticationType(),
      passwordIsAutoGenerated:
        !!preferenceService.store.passwordIsAutoGenerated,
      t,
    });
  }, [authEnabled, supportedBiometryType, devicePasscodeAvailable, t]);

  return computed;
}

const isFetchingBiometricsRef = { current: false };
const fetchBiometrics = async () => {
  if (isFetchingBiometricsRef.current) return;

  isFetchingBiometricsRef.current = true;
  try {
    let systemAuth = {
      supportedBiometryType: null as KeychainSupportedBiometryType,
      devicePasscodeAvailable: false,
    };
    let didFetchSupportedType = false;
    try {
      systemAuth = await fetchSystemAuthAvailability();
      didFetchSupportedType = true;
    } catch (error) {
      console.error(error);
    }
    const enabledBySetting = isAuthenticatedByBiometrics();
    const entryReady = await checkAndroidBiometricsEntryReady();
    const nextAuthEnabledByEntry = enabledBySetting && entryReady;

    setBiometrics(prev => {
      if (!didFetchSupportedType) {
        return prev;
      }
      // if (prev.authEnabled && !supportedType) {
      //   toast.info(
      //     'Biometrics authentication disabled because no valid biometric data found.',
      //   );
      // }
      return {
        ...prev,
        ...systemAuth,
        supportedBiometryType:
          systemAuth.supportedBiometryType ||
          (!IS_ANDROID && nextAuthEnabledByEntry
            ? prev.supportedBiometryType
            : null),
        authEnabled: nextAuthEnabledByEntry,
      };
    });
  } catch (error) {
    console.error(error);
  } finally {
    isFetchingBiometricsRef.current = false;
  }
};

const toggleBiometrics = async <T extends boolean>(
  nextEnabled: T,
  input: {
    tipLoading?: boolean;
    authenticationType?: KEYCHAIN_AUTH_TYPES;
  } & (T extends true
    ? { validatedPassword: string }
    : { validatedPassword?: undefined }),
) => {
  const { validatedPassword, tipLoading, authenticationType } = input;
  let changed = false;

  const hideToast = !tipLoading
    ? null
    : toastLoading(`${nextEnabled ? 'Enabling' : 'Disabling'} biometrics`);

  const reset = async () => {
    await apisKeychain.resetGenericPassword();
    setBiometrics(prev => ({ ...prev, authEnabled: false }));
  };

  try {
    if (!nextEnabled) {
      await reset();
      changed = true;
    } else {
      if (!validatedPassword) {
        throw new Error('Validated password is required to enable biometrics.');
      }

      await apisKeychain.setGenericPassword(
        validatedPassword,
        authenticationType ??
          apisKeychain.getDefaultBiometricsAuthenticationType(),
      );
      const requestResult = await apisKeychain.requestGenericPassword({
        purpose: RequestGenericPurpose.VERIFY,
      });
      if (!requestResult) {
        await reset();
      } else if (requestResult && requestResult.actionSuccess) {
        setBiometrics(prev => ({ ...prev, authEnabled: true }));
        changed = true;
      }
    }
  } catch (error: any) {
    if (nextEnabled) {
      await reset();
      return false;
    }

    const parsedInfo = parseKeychainError(error);
    if (parsedInfo.isCancelledByUser || (__DEV__ && parsedInfo.sysMessage)) {
      toast.show(parsedInfo.sysMessage);
    } else {
      toast.show(error?.message);
    }
  } finally {
    hideToast?.();
    await fetchBiometrics();
  }

  return changed && biometricsInfoStore.getState().authEnabled === nextEnabled;
};

export const storeApisBiometrics = {
  fetchBiometrics,
  toggleBiometrics,
  disableBiometricsForCurrentSession,
  ensureBiometricsReadyForUnlock,
};

export function useBiometrics(options?: { autoFetch?: boolean }) {
  const biometrics = biometricsInfoStore(
    useShallow(s => ({
      authEnabled: s.authEnabled,
      supportedBiometryType: s.supportedBiometryType,
      devicePasscodeAvailable: s.devicePasscodeAvailable,
    })),
  );

  useEffect(() => {
    if (options?.autoFetch) {
      fetchBiometrics();
    }
  }, [options?.autoFetch]);

  const computed = useBiometricsComputed();

  return {
    biometrics,
    computed,
    fetchBiometrics,
    toggleBiometrics,
  };
}

type BiometricsStubModalState = {
  status: 'idle' | 'preparing' | 'processing' | 'success' | 'failed';
  lastStubBehaviors: ValidationBehaviorProps | null;
};
const biometricsStubModalState = zCreate<BiometricsStubModalState>(() => ({
  status: 'idle',
  lastStubBehaviors: {},
}));
export function setBiometricsStubModalState(
  valOrFunc: UpdaterOrPartials<BiometricsStubModalState>,
) {
  biometricsStubModalState.setState(
    prev => resolveValFromUpdater(prev, valOrFunc).newVal,
  );
}
function getBiometricsStubModalState() {
  return biometricsStubModalState.getState();
}

export function useVerifyByBiometrics() {
  const biometricsStatus = biometricsStubModalState(s => s.status);
  const { t } = useTranslation();

  const {
    computed: { isBiometricsEnabled },
  } = useBiometrics();

  const verifyByBiometrics = useCallback(
    async (options?: ValidationBehaviorProps) => {
      if (!isBiometricsEnabled) {
        toast.info(
          t('component.AuthenticationModals.processBiometrics.notEnabled'),
        );
        return;
      }

      const bioStubModalState = getBiometricsStubModalState();

      if (bioStubModalState.status === 'processing') return;
      setBiometricsStubModalState(prev => ({ ...prev, status: 'processing' }));

      const behaviors = options || { ...bioStubModalState.lastStubBehaviors };
      const defaultFinished = () => {
        setTimeout(() => {
          setBiometricsStubModalState(prev => ({ ...prev, status: 'idle' }));
        }, 250);
      };
      const { validationHandler, onFinished = defaultFinished } =
        parseValidationBehavior(behaviors);

      let rawPassword = '';
      let verifyResult: IExtractFromPromise<
        ReturnType<typeof apisKeychain.requestGenericPassword>
      > = null;
      try {
        verifyResult = await apisKeychain.requestGenericPassword({
          purpose: RequestGenericPurpose.DECRYPT_PWD,
          onPlainPassword: password => {
            rawPassword = password;
          },
        });
      } catch (error) {
        __DEV__ && console.debug(error);
        const parsedInfo = parseKeychainError(error);
        if (
          parsedInfo.isCancelledByUser ||
          (__DEV__ && parsedInfo.sysMessage)
        ) {
          toast.info(parsedInfo.sysMessage);
        } else {
          toast.info(
            t('component.AuthenticationModals.processBiometrics.authFailed'),
          );
        }
        // vibration here
        if (error) Vibration.vibrate([100], false);
      }

      try {
        if (!verifyResult || !verifyResult.actionSuccess || !rawPassword) {
          setBiometricsStubModalState(prev => ({ ...prev, status: 'failed' }));
        } else {
          await validationHandler?.(rawPassword);
          setBiometricsStubModalState(prev => ({ ...prev, status: 'success' }));
          onFinished?.({ getValidatedPassword: () => rawPassword });
        }
      } catch (error) {
        setBiometricsStubModalState(prev => ({ ...prev, status: 'failed' }));
      }
    },
    [isBiometricsEnabled, t],
  );

  const abortBiometricsVerification = useCallback(() => {
    setBiometricsStubModalState(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const startBiometricsVerification = useCallback(
    (options?: ValidationBehaviorProps) => {
      setBiometricsStubModalState(prev => ({
        ...prev,
        lastStubBehaviors: { ...options },
        status: 'preparing',
      }));
    },
    [],
  );

  const { isProcessBiometrics, shouldShowStubModal } = useMemo(() => {
    return {
      isProcessBiometrics: biometricsStatus === 'processing',
      shouldShowStubModal: biometricsStatus !== 'idle',
    };
  }, [biometricsStatus]);

  return {
    isProcessBiometrics,
    shouldShowStubModal,
    verifyByBiometrics,
    startBiometricsVerification,
    abortBiometricsVerification,
  };
}
