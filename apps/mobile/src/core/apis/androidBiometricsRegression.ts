import { Platform } from 'react-native';
import { useCallback } from 'react';

import { isNonPublicProductionEnv } from '@/constant';
import { zustandByMMKV } from '@/core/storage/mmkv';

export const ANDROID_BIOMETRIC_SECURITY_LEVELS = {
  STRONG: 'strong',
  WEAK: 'weak',
} as const;

export type AndroidBiometricSecurityLevel =
  (typeof ANDROID_BIOMETRIC_SECURITY_LEVELS)[keyof typeof ANDROID_BIOMETRIC_SECURITY_LEVELS];

type AndroidBiometricsRegressionState = {
  allowWeakFaceBiometricsForRegression: boolean;
};

const androidBiometricsRegressionStore =
  zustandByMMKV<AndroidBiometricsRegressionState>(
    '@AndroidBiometricsRegressionSettings',
    {
      allowWeakFaceBiometricsForRegression: false,
    },
  );

function canUseAndroidBiometricsRegressionSwitch() {
  return Platform.OS === 'android' && isNonPublicProductionEnv;
}

export function getAllowWeakFaceBiometricsForRegression() {
  return (
    canUseAndroidBiometricsRegressionSwitch() &&
    androidBiometricsRegressionStore.getState()
      .allowWeakFaceBiometricsForRegression
  );
}

export function getAndroidBiometricSecurityLevel(): AndroidBiometricSecurityLevel {
  return getAllowWeakFaceBiometricsForRegression()
    ? ANDROID_BIOMETRIC_SECURITY_LEVELS.WEAK
    : ANDROID_BIOMETRIC_SECURITY_LEVELS.STRONG;
}

export function getAndroidBiometricSecurityLevelOptions():
  | { androidBiometricSecurityLevel: AndroidBiometricSecurityLevel }
  | Record<string, never> {
  if (Platform.OS !== 'android') {
    return {};
  }

  return {
    androidBiometricSecurityLevel: getAndroidBiometricSecurityLevel(),
  };
}

export function getAndroidRegressionBiometricSecurityLevelOptions():
  | { androidBiometricSecurityLevel: AndroidBiometricSecurityLevel }
  | Record<string, never> {
  if (Platform.OS !== 'android') {
    return {};
  }

  return getAndroidBiometricSecurityLevelOptions();
}

export function setAllowWeakFaceBiometricsForRegression(nextVal: boolean) {
  if (!canUseAndroidBiometricsRegressionSwitch()) {
    return false;
  }

  androidBiometricsRegressionStore.setState(prev => ({
    ...prev,
    allowWeakFaceBiometricsForRegression: nextVal,
  }));

  return nextVal;
}

export function useAndroidWeakFaceBiometricsRegressionSwitch() {
  const rawEnabled = androidBiometricsRegressionStore(
    s => s.allowWeakFaceBiometricsForRegression,
  );
  const canUse = canUseAndroidBiometricsRegressionSwitch();

  const setEnabled = useCallback((nextVal?: boolean) => {
    if (!canUseAndroidBiometricsRegressionSwitch()) {
      return false;
    }

    const current =
      androidBiometricsRegressionStore.getState()
        .allowWeakFaceBiometricsForRegression;
    return setAllowWeakFaceBiometricsForRegression(
      typeof nextVal === 'boolean' ? nextVal : !current,
    );
  }, []);

  return {
    canUse,
    allowWeakFaceBiometricsForRegression: canUse && rawEnabled,
    setAllowWeakFaceBiometricsForRegression: setEnabled,
  };
}
