const {
  resolveStartupProfilerWorkerDeferral,
} = require('./react-native-architecture.cjs');

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
