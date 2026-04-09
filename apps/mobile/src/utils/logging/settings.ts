import { useCallback } from 'react';
import { zustandByMMKV } from '@/core/storage/mmkv';
import { APP_RUNTIME_ENV } from '@/constant/env';

type AppLogFileSettings = {
  regressionFileLoggingEnabled: boolean;
};

const appLogFileSettingsStore = zustandByMMKV<AppLogFileSettings>(
  '@AppLogFileSettings',
  {
    regressionFileLoggingEnabled: true,
  },
);

export function getEffectiveFileLoggingEnabled() {
  switch (APP_RUNTIME_ENV) {
    case 'production':
      return true;
    case 'regression':
      return appLogFileSettingsStore.getState().regressionFileLoggingEnabled;
    default:
      return false;
  }
}

export function setRegressionFileLoggingEnabled(nextValue: boolean) {
  if (APP_RUNTIME_ENV !== 'regression') {
    return getEffectiveFileLoggingEnabled();
  }

  appLogFileSettingsStore.setState({
    regressionFileLoggingEnabled: nextValue,
  });

  return nextValue;
}

export function subscribeAppLogFileSettings(listener: () => void) {
  return appLogFileSettingsStore.subscribe(listener);
}

export function useAppLogFileSwitch() {
  const regressionFileLoggingEnabled = appLogFileSettingsStore(
    state => state.regressionFileLoggingEnabled,
  );

  const effectiveEnabled = getEffectiveFileLoggingEnabled();
  const canToggle = APP_RUNTIME_ENV === 'regression';
  const isForcedOn = APP_RUNTIME_ENV === 'production';

  const onToggle = useCallback(
    (nextValue?: boolean) => {
      const targetValue =
        typeof nextValue === 'boolean'
          ? nextValue
          : !regressionFileLoggingEnabled;

      return setRegressionFileLoggingEnabled(targetValue);
    },
    [regressionFileLoggingEnabled],
  );

  return {
    canToggle,
    isForcedOn,
    effectiveEnabled,
    regressionFileLoggingEnabled,
    onToggle,
  };
}
