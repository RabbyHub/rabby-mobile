type Profiler = typeof import('./hermesStartupProfiler');
type SentryResult = {
  profile?: string;
  androidProfile?: unknown;
  error?: string;
};

const runtime = globalThis as typeof globalThis & {
  __DEV__: boolean;
  __RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__?: number;
  __RABBY_STARTUP_PROFILER_DEFER_WORKER_UNTIL__?: number;
  __RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__?: number;
  nativeTraceBeginSection?: (tag: number, name: string) => void;
  nativeTraceEndSection?: (tag: number) => void;
};
const originalDev = runtime.__DEV__;
const originalTraceBegin = runtime.nativeTraceBeginSection;
const originalTraceEnd = runtime.nativeTraceEndSection;
const events: string[] = [];
const sentry = {
  startProfiling: jest.fn<{ started: boolean; error?: string }, [boolean]>(),
  stopProfiling: jest.fn<SentryResult, []>(),
};
const nativeStop = jest.fn<boolean, []>();
const writeFile = jest.fn<Promise<void>, [string, string, string]>();
let turboModules: Record<string, unknown>;
let native: {
  Platform: { OS: string };
  NativeModules: Record<string, unknown>;
  TurboModuleRegistry: { get: jest.Mock<unknown, [string]> };
};

function loadProfiler(os = 'ios'): Profiler {
  native.Platform.OS = os;
  return require('./hermesStartupProfiler');
}

function startSession(profiler: Profiler) {
  native.Platform.OS = 'android';
  return profiler.startHermesProfilerSession({
    label: 'test-session',
    expectedDurationMs: 2000,
    deferWorker: true,
  });
}

function expectCaptureFlagsCleared() {
  expect(runtime.__RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__ || 0).toBe(0);
  expect(runtime.__RABBY_STARTUP_PROFILER_DEFER_WORKER_UNTIL__ || 0).toBe(0);
  expect(
    runtime.__RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__ || 0,
  ).toBe(0);
}

describe('Hermes profiler native stop ownership (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(100_000);
    runtime.__DEV__ = true;
    events.length = 0;
    sentry.startProfiling.mockReset().mockImplementation(() => {
      events.push('sentry-start');
      return { started: true };
    });
    sentry.stopProfiling.mockReset().mockImplementation(() => {
      events.push('sentry-stop');
      return { profile: 'hermes-profile' };
    });
    nativeStop.mockReset().mockImplementation(() => {
      events.push('native-stop');
      return true;
    });
    writeFile.mockReset().mockImplementation(async () => {
      events.push('persist');
    });
    turboModules = {
      RNSentry: sentry,
      RNHelpers: { androidStopHermesSamplingProfiler: nativeStop },
    };
    native = {
      Platform: { OS: 'ios' },
      NativeModules: {},
      TurboModuleRegistry: {
        get: jest.fn(name => turboModules[name] ?? null),
      },
    };
    jest.doMock('react-native', () => native);
    jest.doMock('@rabby-wallet/react-native-fs', () => ({
      __esModule: true,
      default: { ExternalDirectoryPath: '/test-profiles', writeFile },
    }));
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    runtime.__DEV__ = originalDev;
    runtime.nativeTraceBeginSection = originalTraceBegin;
    runtime.nativeTraceEndSection = originalTraceEnd;
    delete runtime.__RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__;
    delete runtime.__RABBY_STARTUP_PROFILER_DEFER_WORKER_UNTIL__;
    delete runtime.__RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__;
  });

  it.each(['turbo', 'legacy-null', 'legacy-throw'])(
    'resolves both native boundaries via %s',
    async registry => {
      if (registry !== 'turbo') {
        native.NativeModules = turboModules;
        turboModules = {};
        if (registry === 'legacy-throw') {
          native.TurboModuleRegistry.get.mockImplementation(() => {
            throw new Error('Turbo registry unavailable');
          });
        }
      }
      const profiler = loadProfiler();
      const session = startSession(profiler);
      expect(session).not.toBeNull();
      expect(sentry.startProfiling).toHaveBeenCalledWith(true);
      expect(profiler.isHermesProfilerSessionActive()).toBe(true);
      await session!.stop();
      expect(nativeStop).toHaveBeenCalledTimes(1);
      expect(profiler.isHermesProfilerSessionActive()).toBe(false);
    },
  );

  it.each([null, {}, { androidStopHermesSamplingProfiler: undefined }])(
    'does not start on an old APK without a callable stop helper: %p',
    helper => {
      turboModules.RNHelpers = helper;
      const profiler = loadProfiler('android');
      expect(startSession(profiler)).toBeNull();
      expect(sentry.startProfiling).not.toHaveBeenCalled();
      expect(sentry.stopProfiling).not.toHaveBeenCalled();
      expect(nativeStop).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
      expect(profiler.isHermesProfilerSessionActive()).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      expectCaptureFlagsCleared();
    },
  );

  it('stops Sentry then the real sampler synchronously before persistence; stop is idempotent', async () => {
    let finishWrite!: () => void;
    writeFile.mockImplementationOnce(() => {
      events.push('persist');
      return new Promise<void>(resolve => {
        finishWrite = resolve;
      });
    });
    const profiler = loadProfiler();
    const session = startSession(profiler)!;
    expect(
      runtime.__RABBY_STARTUP_PROFILER_DEFER_WORKER_UNTIL__,
    ).toBeGreaterThan(Date.now());
    expect(startSession(profiler)).toBeNull();
    const first = session.stop();
    expect(events).toEqual(['sentry-start', 'sentry-stop', 'native-stop']);
    expect(session.stop()).toBe(first);
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual([
      'sentry-start',
      'sentry-stop',
      'native-stop',
      'persist',
    ]);
    finishWrite();
    const result = await first;
    expect(result.error).toBeUndefined();
    expect(result.profilePath).toMatch(/^\/test-profiles\/.*\.cpuprofile$/);
    expect(writeFile).toHaveBeenCalledWith(
      result.profilePath,
      'hermes-profile',
      'utf8',
    );
    expect(session.stop()).toBe(first);
    expect(sentry.stopProfiling).toHaveBeenCalledTimes(1);
    expect(nativeStop).toHaveBeenCalledTimes(1);
    expectCaptureFlagsCleared();
    expect(profiler.isHermesProfilerSessionActive()).toBe(false);
    expect(startSession(profiler)).not.toBeNull();
  });

  it.each(['throw', 'error-result'])(
    'still stops the native sampler when Sentry stop returns %s',
    async failure => {
      sentry.stopProfiling.mockImplementation(() => {
        events.push('sentry-stop');
        if (failure === 'throw') {
          throw new Error('Sentry stop failed');
        }
        return { error: 'Sentry stop failed' };
      });
      const profiler = loadProfiler();
      const result = await startSession(profiler)!.stop();
      expect(events).toEqual(['sentry-start', 'sentry-stop', 'native-stop']);
      expect(result.error).toContain('Sentry stop failed');
      expect(writeFile).not.toHaveBeenCalled();
      expectCaptureFlagsCleared();
      expect(profiler.isHermesProfilerSessionActive()).toBe(false);
    },
  );

  it.each(['false', 'throw'])(
    'retains ownership and blocks restarting when native stop returns %s',
    async failure => {
      nativeStop.mockImplementation(() => {
        events.push('native-stop');
        if (failure === 'throw') {
          throw new Error('Native stop failed');
        }
        return false;
      });
      const profiler = loadProfiler();
      const session = startSession(profiler)!;
      const result = await session.stop();
      expect(result.error).toEqual(expect.any(String));
      expect(result.error).not.toBe('');
      expect(profiler.isHermesProfilerSessionActive()).toBe(true);
      expect(startSession(profiler)).toBeNull();
      expect(sentry.startProfiling).toHaveBeenCalledTimes(1);
      await session.stop();
      expect(nativeStop).toHaveBeenCalledTimes(1);
      expectCaptureFlagsCleared();
    },
  );

  it.each(['false', 'throw'])(
    'cleans up a partial start returning %s without persisting discarded data',
    failure => {
      sentry.startProfiling.mockImplementation(() => {
        events.push('sentry-start');
        if (failure === 'throw') {
          throw new Error('Partial start failed');
        }
        return { started: false, error: 'Partial start failed' };
      });
      const profiler = loadProfiler();
      expect(startSession(profiler)).toBeNull();
      expect(events).toEqual(['sentry-start', 'sentry-stop', 'native-stop']);
      expect(writeFile).not.toHaveBeenCalled();
      expect(profiler.isHermesProfilerSessionActive()).toBe(false);
      expectCaptureFlagsCleared();
    },
  );

  it.each(['false', 'throw'])(
    'keeps the failed-start owner when native cleanup returns %s, even if Sentry cleanup throws',
    failure => {
      sentry.startProfiling.mockReturnValue({ started: false });
      sentry.stopProfiling.mockImplementation(() => {
        throw new Error('Partial Sentry cleanup failed');
      });
      nativeStop.mockImplementation(() => {
        if (failure === 'throw') {
          throw new Error('Partial native cleanup failed');
        }
        return false;
      });
      const profiler = loadProfiler();
      expect(startSession(profiler)).toBeNull();
      expect(nativeStop).toHaveBeenCalledTimes(1);
      expect(profiler.isHermesProfilerSessionActive()).toBe(true);
      expect(startSession(profiler)).toBeNull();
      expect(sentry.startProfiling).toHaveBeenCalledTimes(1);
      expect(writeFile).not.toHaveBeenCalled();
      expectCaptureFlagsCleared();
    },
  );

  it('reports persistence failure after native shutdown and releases the owner', async () => {
    writeFile.mockRejectedValue(new Error('Disk unavailable'));
    const profiler = loadProfiler();
    const result = await startSession(profiler)!.stop();
    expect(result.error).toContain('Disk unavailable');
    expect(nativeStop).toHaveBeenCalledTimes(1);
    expect(profiler.isHermesProfilerSessionActive()).toBe(false);
    expectCaptureFlagsCleared();
  });

  it.each(['begin', 'end'])(
    'still starts and stops the sampler when the %s trace boundary throws',
    async boundary => {
      const failTrace = () => {
        throw new Error('Trace unavailable');
      };
      runtime.nativeTraceBeginSection =
        boundary === 'begin' ? failTrace : jest.fn();
      runtime.nativeTraceEndSection =
        boundary === 'end' ? failTrace : jest.fn();
      const profiler = loadProfiler();
      const session = startSession(profiler);
      expect(session).not.toBeNull();
      const result = await session!.stop();
      expect(result.error).toBeUndefined();
      expect(sentry.stopProfiling).toHaveBeenCalledTimes(1);
      expect(nativeStop).toHaveBeenCalledTimes(1);
      expect(profiler.isHermesProfilerSessionActive()).toBe(false);
      expectCaptureFlagsCleared();
    },
  );

  it('preserves both native-stop and persistence errors without releasing the failed owner', async () => {
    nativeStop.mockImplementation(() => {
      throw new Error('Native shutdown failed');
    });
    writeFile.mockRejectedValue(new Error('Profile write failed'));
    const profiler = loadProfiler();
    const result = await startSession(profiler)!.stop();
    expect(result.error).toContain('Native shutdown failed');
    expect(result.error).toContain('Profile write failed');
    expect(nativeStop).toHaveBeenCalledTimes(1);
    expect(profiler.isHermesProfilerSessionActive()).toBe(true);
    expect(startSession(profiler)).toBeNull();
    expect(sentry.startProfiling).toHaveBeenCalledTimes(1);
    expectCaptureFlagsCleared();
  });

  it('does not persist when stop has no profile data', async () => {
    sentry.stopProfiling.mockReturnValue({});
    const profiler = loadProfiler();
    const result = await startSession(profiler)!.stop();
    expect(nativeStop).toHaveBeenCalledTimes(1);
    expect(writeFile).not.toHaveBeenCalled();
    expect(result.profilePath).toBeUndefined();
    expect(result.androidProfilePath).toBeUndefined();
  });

  it('starts once on Android module load and stops at the 10-second startup deadline', async () => {
    sentry.stopProfiling.mockReturnValue({});
    const profiler = loadProfiler('android');
    profiler.startHermesStartupProfiler();
    expect(sentry.startProfiling).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9999);
    expect(sentry.stopProfiling).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(sentry.stopProfiling).toHaveBeenCalledTimes(1);
    expect(nativeStop).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(profiler.isHermesProfilerSessionActive()).toBe(false);
    expectCaptureFlagsCleared();
    profiler.startHermesStartupProfiler();
    expect(sentry.startProfiling).toHaveBeenCalledTimes(1);
  });

  it('never starts or persists on iOS', () => {
    const profiler = loadProfiler('ios');
    expect(
      profiler.startHermesProfilerSession({
        label: 'ios',
        expectedDurationMs: 1000,
      }),
    ).toBeNull();
    expect(sentry.startProfiling).not.toHaveBeenCalled();
    expect(nativeStop).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  // Babel inlines these build flags. Run this same unit suite in a separate
  // production/appstore Jest process to exercise the production branch.
  if (
    process.env.RABBY_MOBILE_BUILD_ENV === 'production' &&
    process.env.buildchannel !== 'selfhost-reg'
  ) {
    it('never starts or persists in a non-development production build', () => {
      runtime.__DEV__ = false;
      const profiler = loadProfiler('android');
      expect(startSession(profiler)).toBeNull();
      expect(sentry.startProfiling).not.toHaveBeenCalled();
      expect(nativeStop).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
  } else {
    it('allows non-development regression/non-production profiling with the helper', async () => {
      runtime.__DEV__ = false;
      const profiler = loadProfiler();
      const session = startSession(profiler);
      expect(session).not.toBeNull();
      await session!.stop();
      expect(nativeStop).toHaveBeenCalledTimes(1);
    });
  }
});
