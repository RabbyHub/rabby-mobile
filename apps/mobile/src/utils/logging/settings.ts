import { useCallback } from 'react';
import { zustandByMMKV } from '@/core/storage/mmkv';
import { APP_RUNTIME_ENV } from '@/constant/env';
import { isNonPublicProductionEnv } from '@/constant';
import { getOnlineConfig } from '@/core/config/online';
import {
  APP_FILE_LOGGING_ONLINE_SWITCH,
  type AppLogPolicyEnv,
  getDefaultLocalAppFileLoggingEnabled,
  resolveAppLogPolicyEnv,
  resolveAppFileLoggingEnabled,
  resolveConsoleCaptureEnabled,
} from './policy';

type AppLogFileSettings = {
  developmentFileLoggingEnabled?: boolean;
  regressionFileLoggingEnabled?: boolean;
  nonProdFileLoggingEnabled?: boolean;
};

const appLogFileSettingsStore = zustandByMMKV<AppLogFileSettings>(
  '@AppLogFileSettings',
  {
    developmentFileLoggingEnabled:
      getDefaultLocalAppFileLoggingEnabled('development'),
    regressionFileLoggingEnabled:
      getDefaultLocalAppFileLoggingEnabled('regression'),
  },
);

function getProdOnlineLoggingEnabled() {
  return !!getOnlineConfig()?.switches?.[APP_FILE_LOGGING_ONLINE_SWITCH];
}

function getAppLogPolicyEnv(): AppLogPolicyEnv {
  return resolveAppLogPolicyEnv({
    runtimeEnv: APP_RUNTIME_ENV,
    isNonPublicProductionEnv,
  });
}

function resolveLocalFileLoggingEnabled(
  state: AppLogFileSettings,
  policyEnv: string = getAppLogPolicyEnv(),
) {
  switch (policyEnv) {
    case 'development':
      if (typeof state.developmentFileLoggingEnabled === 'boolean') {
        return state.developmentFileLoggingEnabled;
      }

      if (typeof state.nonProdFileLoggingEnabled === 'boolean') {
        return state.nonProdFileLoggingEnabled;
      }

      return getDefaultLocalAppFileLoggingEnabled(policyEnv);
    case 'regression':
      if (typeof state.regressionFileLoggingEnabled === 'boolean') {
        return state.regressionFileLoggingEnabled;
      }

      return getDefaultLocalAppFileLoggingEnabled(policyEnv);
    default:
      return getDefaultLocalAppFileLoggingEnabled(policyEnv);
  }
}

function getLocalFileLoggingEnabled(policyEnv = getAppLogPolicyEnv()) {
  return resolveLocalFileLoggingEnabled(
    appLogFileSettingsStore.getState(),
    policyEnv,
  );
}

export function getEffectiveFileLoggingEnabled() {
  const policyEnv = getAppLogPolicyEnv();

  return resolveAppFileLoggingEnabled({
    runtimeEnv: policyEnv,
    localEnabled: getLocalFileLoggingEnabled(policyEnv),
    prodOnlineEnabled: getProdOnlineLoggingEnabled(),
  });
}

export function getEffectiveConsoleCaptureEnabled() {
  const policyEnv = getAppLogPolicyEnv();

  return resolveConsoleCaptureEnabled({
    runtimeEnv: policyEnv,
    localEnabled: getLocalFileLoggingEnabled(policyEnv),
    prodOnlineEnabled: getProdOnlineLoggingEnabled(),
  });
}

export function setLocalFileLoggingEnabled(nextValue: boolean) {
  const policyEnv = getAppLogPolicyEnv();

  if (policyEnv === 'production') {
    return getEffectiveFileLoggingEnabled();
  }

  appLogFileSettingsStore.setState(
    policyEnv === 'development'
      ? { developmentFileLoggingEnabled: nextValue }
      : { regressionFileLoggingEnabled: nextValue },
  );

  return nextValue;
}

export function subscribeAppLogFileSettings(listener: () => void) {
  return appLogFileSettingsStore.subscribe(listener);
}

export function useAppLogFileSwitch() {
  const policyEnv = getAppLogPolicyEnv();
  const localFileLoggingEnabled = appLogFileSettingsStore(state =>
    resolveLocalFileLoggingEnabled(state, policyEnv),
  );

  const effectiveEnabled = getEffectiveFileLoggingEnabled();
  const consoleCaptureEnabled = getEffectiveConsoleCaptureEnabled();
  const localDefaultEnabled = getDefaultLocalAppFileLoggingEnabled(policyEnv);
  const canToggle = policyEnv !== 'production';
  const isOnlineControlled = policyEnv === 'production';

  const onToggle = useCallback(
    (nextValue?: boolean) => {
      const targetValue =
        typeof nextValue === 'boolean' ? nextValue : !localFileLoggingEnabled;

      return setLocalFileLoggingEnabled(targetValue);
    },
    [localFileLoggingEnabled],
  );

  return {
    runtimeEnv: APP_RUNTIME_ENV,
    policyEnv,
    canToggle,
    isOnlineControlled,
    effectiveEnabled,
    consoleCaptureEnabled,
    localDefaultEnabled,
    localFileLoggingEnabled,
    onToggle,
  };
}
