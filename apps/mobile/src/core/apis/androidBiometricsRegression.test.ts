function loadAndroidBiometricsRegressionModule({
  platform = 'android',
  isNonPublicProductionEnv = true,
}: {
  platform?: 'android' | 'ios';
  isNonPublicProductionEnv?: boolean;
} = {}) {
  jest.resetModules();

  let state: Record<string, unknown> = {};

  jest.doMock('react-native', () => ({
    Platform: { OS: platform },
  }));
  jest.doMock('@/constant', () => ({
    isNonPublicProductionEnv,
  }));
  jest.doMock('@/core/storage/mmkv', () => ({
    zustandByMMKV: jest.fn((_key: string, initialValue: object) => {
      state = { ...initialValue };

      const store = ((selector?: (nextState: typeof state) => unknown) =>
        selector ? selector(state) : state) as unknown as {
        (selector?: (nextState: typeof state) => unknown): unknown;
        getState: () => typeof state;
        setState: (
          updater:
            | typeof state
            | ((previousState: typeof state) => typeof state),
        ) => void;
      };

      store.getState = () => state;
      store.setState = updater => {
        state =
          typeof updater === 'function'
            ? updater(state)
            : { ...state, ...updater };
      };

      return store;
    }),
  }));

  return require('./androidBiometricsRegression') as typeof import('./androidBiometricsRegression');
}

describe('androidBiometricsRegression', () => {
  it('uses strong Android biometrics by default', () => {
    const module = loadAndroidBiometricsRegressionModule();

    expect(module.getAndroidBiometricSecurityLevelOptions()).toEqual({
      androidBiometricSecurityLevel:
        module.ANDROID_BIOMETRIC_SECURITY_LEVELS.STRONG,
    });
  });

  it('allows weak Android biometrics only when the regression switch is on', () => {
    const module = loadAndroidBiometricsRegressionModule();

    module.setAllowWeakFaceBiometricsForRegression(true);

    expect(module.getAndroidBiometricSecurityLevelOptions()).toEqual({
      androidBiometricSecurityLevel:
        module.ANDROID_BIOMETRIC_SECURITY_LEVELS.WEAK,
    });
  });

  it('keeps production Android calls strong even if the switch is requested', () => {
    const module = loadAndroidBiometricsRegressionModule({
      isNonPublicProductionEnv: false,
    });

    expect(module.setAllowWeakFaceBiometricsForRegression(true)).toBe(false);
    expect(module.getAndroidBiometricSecurityLevelOptions()).toEqual({
      androidBiometricSecurityLevel:
        module.ANDROID_BIOMETRIC_SECURITY_LEVELS.STRONG,
    });
  });

  it('does not add Android-only options on iOS', () => {
    const module = loadAndroidBiometricsRegressionModule({ platform: 'ios' });

    module.setAllowWeakFaceBiometricsForRegression(true);

    expect(module.getAndroidBiometricSecurityLevelOptions()).toEqual({});
  });
});
