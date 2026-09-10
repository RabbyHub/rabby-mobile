const {
  resolveReactNativeArchitecture,
  resolveStartupProfilerWorkerDeferral,
} = require('./react-native-architecture.cjs');

describe('resolveReactNativeArchitecture', () => {
  it('keeps the legacy architecture by default', () => {
    expect(resolveReactNativeArchitecture({})).toBe('legacy');
  });

  it.each(['1', 'true', 'yes', 'on'])(
    'accepts RCT_NEW_ARCH_ENABLED=%s for the new architecture',
    value => {
      expect(
        resolveReactNativeArchitecture({ RCT_NEW_ARCH_ENABLED: value }),
      ).toBe('new');
    },
  );

  it('accepts the Gradle environment property as the architecture source', () => {
    expect(
      resolveReactNativeArchitecture({
        ORG_GRADLE_PROJECT_newArchEnabled: 'true',
      }),
    ).toBe('new');
  });

  it('rejects mismatched JavaScript and Gradle architecture flags', () => {
    expect(() =>
      resolveReactNativeArchitecture({
        RCT_NEW_ARCH_ENABLED: '1',
        ORG_GRADLE_PROJECT_newArchEnabled: 'false',
      }),
    ).toThrow('resolve to different architectures');
  });
});

describe('resolveStartupProfilerWorkerDeferral', () => {
  it('keeps worker startup unchanged by default', () => {
    expect(resolveStartupProfilerWorkerDeferral({})).toBe(false);
  });

  it('accepts an explicit profiler-only deferral', () => {
    expect(
      resolveStartupProfilerWorkerDeferral({
        RABBY_STARTUP_PROFILER_DEFER_WORKER: 'true',
      }),
    ).toBe(true);
  });

  it('rejects invalid values instead of changing startup implicitly', () => {
    expect(() =>
      resolveStartupProfilerWorkerDeferral({
        RABBY_STARTUP_PROFILER_DEFER_WORKER: 'sometimes',
      }),
    ).toThrow('RABBY_STARTUP_PROFILER_DEFER_WORKER');
  });
});
