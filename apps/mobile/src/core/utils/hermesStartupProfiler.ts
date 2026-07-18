import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

type SentryProfilerModule = {
  startProfiling?: (platformProfilers: boolean) => {
    started?: boolean;
    error?: string;
  };
  stopProfiling?: () => {
    profile?: string;
    androidProfile?: unknown;
    nativeProfile?: unknown;
    error?: string;
  };
};

const PROFILE_WINDOW_MS = 10000;
const PROFILE_WORKER_DEFER_EXTRA_MS = 1500;
const PROFILE_FILE_PREFIX = 'rabby-startup-profile';
const TRACE_TAG_REACT = 1 << 13;

let didStartStartupProfiler = false;
let activeProfilerSession: HermesProfilerSessionState | null = null;

type StartupProfilerGlobal = typeof globalThis & {
  __RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__?: number;
  __RABBY_STARTUP_PROFILER_DEFER_WORKER_UNTIL__?: number;
  __RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__?: number;
};

type HermesProfilerSessionState = {
  label: string;
  startedAt: number;
};

export type HermesProfilerSessionResult = {
  label: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  profilePath?: string;
  androidProfilePath?: string;
  error?: string;
};

export type HermesProfilerSession = {
  label: string;
  startedAt: number;
  stop: () => Promise<HermesProfilerSessionResult>;
};

type StartHermesProfilerSessionOptions = {
  label: string;
  expectedDurationMs: number;
  filePrefix?: string;
  includePlatformProfile?: boolean;
  deferWorker?: boolean;
};

const isHermesProfilerEnabled =
  __DEV__ ||
  process.env.RABBY_MOBILE_BUILD_ENV !== 'production' ||
  process.env.buildchannel === 'selfhost-reg';

const shouldDeferWorkerDuringStartupProfile =
  process.env.RABBY_STARTUP_PROFILER_DEFER_WORKER === 'true';

function setProfilerActiveUntil(activeUntil: number, deferWorker: boolean) {
  const profilerGlobal = globalThis as StartupProfilerGlobal;

  profilerGlobal.__RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__ = activeUntil;
  profilerGlobal.__RABBY_STARTUP_PROFILER_DEFER_WORKER_UNTIL__ = deferWorker
    ? activeUntil
    : 0;
  profilerGlobal.__RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__ =
    activeUntil;
}

function traceHermesProfilerInstant(name: string) {
  const traceGlobal = globalThis as typeof globalThis & {
    nativeTraceBeginSection?: (tag: number, name: string) => void;
    nativeTraceEndSection?: (tag: number) => void;
  };

  if (
    typeof traceGlobal.nativeTraceBeginSection !== 'function' ||
    typeof traceGlobal.nativeTraceEndSection !== 'function'
  ) {
    return;
  }

  traceGlobal.nativeTraceBeginSection(
    TRACE_TAG_REACT,
    `Rabby:${name}`.slice(0, 110),
  );
  traceGlobal.nativeTraceEndSection(TRACE_TAG_REACT);
}

function getSentryProfilerModule(): SentryProfilerModule | null {
  try {
    const turboModule = TurboModuleRegistry.get(
      'RNSentry',
    ) as SentryProfilerModule | null;

    if (turboModule) {
      return turboModule;
    }
  } catch {
    // Fall back to the legacy module registry below.
  }

  return (NativeModules.RNSentry as SentryProfilerModule | undefined) || null;
}

function sanitizeProfileFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function persistHermesProfile(
  profile: string | undefined,
  androidProfile: unknown,
  filePrefix: string,
) {
  if (!profile && !androidProfile) {
    return {};
  }

  const RNFS = await import('@rabby-wallet/react-native-fs');
  const baseDir = RNFS.default.ExternalDirectoryPath;
  if (!baseDir) {
    throw new Error('Missing external directory');
  }

  const timestamp = Date.now();
  const safePrefix =
    sanitizeProfileFilePart(filePrefix) || 'rabby-hermes-profile';
  const basePath = `${baseDir}/${safePrefix}-${timestamp}`;
  const result: Pick<
    HermesProfilerSessionResult,
    'profilePath' | 'androidProfilePath'
  > = {};

  if (profile) {
    result.profilePath = `${basePath}.cpuprofile`;
    await RNFS.default.writeFile(result.profilePath, profile, 'utf8');
    console.info('[RabbyHermesProfiler] hermes_profile_saved', {
      path: result.profilePath,
      bytes: profile.length,
    });
  }

  if (androidProfile) {
    const content = JSON.stringify(androidProfile);
    result.androidProfilePath = `${basePath}.android-profile.json`;
    await RNFS.default.writeFile(result.androidProfilePath, content, 'utf8');
    console.info('[RabbyHermesProfiler] android_profile_saved', {
      path: result.androidProfilePath,
      bytes: content.length,
    });
  }

  return result;
}

export function isHermesProfilerSessionActive() {
  return activeProfilerSession !== null;
}

export function startHermesProfilerSession({
  label,
  expectedDurationMs,
  filePrefix = `rabby-hermes-profile-${label}`,
  includePlatformProfile = true,
  deferWorker = false,
}: StartHermesProfilerSessionOptions): HermesProfilerSession | null {
  if (
    Platform.OS !== 'android' ||
    !isHermesProfilerEnabled ||
    activeProfilerSession
  ) {
    return null;
  }

  const sentryProfiler = getSentryProfilerModule();
  if (typeof sentryProfiler?.startProfiling !== 'function') {
    console.info('[RabbyHermesProfiler] sentry_profiler_unavailable', {
      label,
    });
    return null;
  }

  const startedAt = Date.now();
  const state: HermesProfilerSessionState = {
    label,
    startedAt,
  };
  const activeUntil =
    startedAt +
    Math.max(1000, expectedDurationMs) +
    PROFILE_WORKER_DEFER_EXTRA_MS;

  try {
    traceHermesProfilerInstant(`js.hermes_profile.${label}.start`);
    const started = sentryProfiler.startProfiling(includePlatformProfile);
    if (started?.started === false) {
      console.info('[RabbyHermesProfiler] start_error', {
        label,
        error: started.error || 'unknown',
      });
      return null;
    }

    activeProfilerSession = state;
    setProfilerActiveUntil(activeUntil, deferWorker);
  } catch (error) {
    setProfilerActiveUntil(0, false);
    console.info(
      '[RabbyHermesProfiler] start_throw',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }

  let stopPromise: Promise<HermesProfilerSessionResult> | null = null;

  return {
    label,
    startedAt,
    stop() {
      if (stopPromise) {
        return stopPromise;
      }

      stopPromise = (async () => {
        let profile: string | undefined;
        let androidProfile: unknown;
        let stopError: string | undefined;

        try {
          traceHermesProfilerInstant(`js.hermes_profile.${label}.stop`);
          const stopped = sentryProfiler.stopProfiling?.();
          profile = stopped?.profile;
          androidProfile =
            stopped?.androidProfile || stopped?.nativeProfile || undefined;
          stopError = stopped?.error;
        } catch (error) {
          stopError = error instanceof Error ? error.message : String(error);
        } finally {
          if (activeProfilerSession === state) {
            activeProfilerSession = null;
          }
          setProfilerActiveUntil(0, false);
        }

        const endedAt = Date.now();
        const result: HermesProfilerSessionResult = {
          label,
          startedAt,
          endedAt,
          durationMs: endedAt - startedAt,
          ...(stopError ? { error: stopError } : {}),
        };

        try {
          Object.assign(
            result,
            await persistHermesProfile(profile, androidProfile, filePrefix),
          );
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error);
        }

        return result;
      })();

      return stopPromise;
    },
  };
}

export function startHermesStartupProfiler() {
  if (
    didStartStartupProfiler ||
    Platform.OS !== 'android' ||
    !isHermesProfilerEnabled
  ) {
    return;
  }

  didStartStartupProfiler = true;
  const session = startHermesProfilerSession({
    label: 'startup',
    expectedDurationMs: PROFILE_WINDOW_MS,
    filePrefix: PROFILE_FILE_PREFIX,
    includePlatformProfile: true,
    deferWorker: shouldDeferWorkerDuringStartupProfile,
  });

  console.info('[RabbyStartupProfiler] start', {
    started: !!session,
    deferWorker: shouldDeferWorkerDuringStartupProfile,
  });
  if (!session) {
    return;
  }

  setTimeout(() => {
    session.stop().then(result => {
      if (result.error) {
        console.info('[RabbyStartupProfiler] stop_error', result.error);
      }
    });
  }, PROFILE_WINDOW_MS);
}

startHermesStartupProfiler();
