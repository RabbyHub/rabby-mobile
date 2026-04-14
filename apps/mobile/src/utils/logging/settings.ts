import { useCallback } from 'react';
import { zustandByMMKV } from '@/core/storage/mmkv';
import { APP_RUNTIME_ENV } from '@/constant/env';
import { getOnlineConfig } from '@/core/config/online';
import {
  APP_FILE_LOGGING_ONLINE_SWITCH,
  getDefaultLocalAppFileLoggingEnabled,
  resolveAppFileLoggingEnabled,
  resolveConsoleCaptureEnabled,
} from './policy';
import { getE2ESilentLogsEnabled } from '../e2eSilentLogs';

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

function resolveLocalFileLoggingEnabled(
  state: AppLogFileSettings,
  runtimeEnv = APP_RUNTIME_ENV,
) {
  switch (runtimeEnv) {
    case 'development':
      if (typeof state.developmentFileLoggingEnabled === 'boolean') {
        return state.developmentFileLoggingEnabled;
      }

      if (typeof state.nonProdFileLoggingEnabled === 'boolean') {
        return state.nonProdFileLoggingEnabled;
      }

      return getDefaultLocalAppFileLoggingEnabled(runtimeEnv);
    case 'regression':
      if (typeof state.regressionFileLoggingEnabled === 'boolean') {
        return state.regressionFileLoggingEnabled;
      }

      return getDefaultLocalAppFileLoggingEnabled(runtimeEnv);
    default:
      return getDefaultLocalAppFileLoggingEnabled(runtimeEnv);
  }
}

function getLocalFileLoggingEnabled(runtimeEnv = APP_RUNTIME_ENV) {
  return resolveLocalFileLoggingEnabled(
    appLogFileSettingsStore.getState(),
    runtimeEnv,
  );
}

export function getEffectiveFileLoggingEnabled() {
  if (getE2ESilentLogsEnabled()) {
    return false;
  }

  return resolveAppFileLoggingEnabled({
    runtimeEnv: APP_RUNTIME_ENV,
    localEnabled: getLocalFileLoggingEnabled(),
    prodOnlineEnabled: getProdOnlineLoggingEnabled(),
  });
}

export function getEffectiveConsoleCaptureEnabled() {
  if (getE2ESilentLogsEnabled()) {
    return false;
  }

  return resolveConsoleCaptureEnabled({
    runtimeEnv: APP_RUNTIME_ENV,
    localEnabled: getLocalFileLoggingEnabled(),
    prodOnlineEnabled: getProdOnlineLoggingEnabled(),
  });
}

export function setLocalFileLoggingEnabled(nextValue: boolean) {
  if (APP_RUNTIME_ENV === 'production') {
    return getEffectiveFileLoggingEnabled();
  }

  appLogFileSettingsStore.setState(
    APP_RUNTIME_ENV === 'development'
      ? { developmentFileLoggingEnabled: nextValue }
      : { regressionFileLoggingEnabled: nextValue },
  );

  return nextValue;
}

export function subscribeAppLogFileSettings(listener: () => void) {
  return appLogFileSettingsStore.subscribe(listener);
}

export function useAppLogFileSwitch() {
  const localFileLoggingEnabled = appLogFileSettingsStore(state =>
    resolveLocalFileLoggingEnabled(state),
  );

  const effectiveEnabled = getEffectiveFileLoggingEnabled();
  const consoleCaptureEnabled = getEffectiveConsoleCaptureEnabled();
  const localDefaultEnabled =
    getDefaultLocalAppFileLoggingEnabled(APP_RUNTIME_ENV);
  const canToggle = APP_RUNTIME_ENV !== 'production';
  const isOnlineControlled = APP_RUNTIME_ENV === 'production';

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
    canToggle,
    isOnlineControlled,
    effectiveEnabled,
    consoleCaptureEnabled,
    localDefaultEnabled,
    localFileLoggingEnabled,
    onToggle,
  };
}
