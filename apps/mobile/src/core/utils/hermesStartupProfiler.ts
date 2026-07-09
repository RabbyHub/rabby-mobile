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

const isStartupProfilerEnabled =
  __DEV__ ||
  process.env.RABBY_MOBILE_BUILD_ENV !== 'production' ||
  process.env.buildchannel === 'selfhost-reg';

function setStartupProfilerActiveUntil(activeUntil: number) {
  (
    globalThis as typeof globalThis & {
      __RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__?: number;
      __RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__?: number;
    }
  ).__RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__ = activeUntil;
  (
    globalThis as typeof globalThis & {
      __RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__?: number;
      __RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__?: number;
    }
  ).__RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__ = activeUntil;
}

function traceStartupProfilerInstant(name: string) {
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
    const turboModule = TurboModuleRegistry.get('RNSentry') as
      | SentryProfilerModule
      | null;

    if (turboModule) {
      return turboModule;
    }
  } catch {
    // Fall back to the legacy module registry below.
  }

  return (NativeModules.RNSentry as SentryProfilerModule | undefined) || null;
}

async function persistStartupProfile(
  profile: string | undefined,
  androidProfile: unknown,
) {
  if (!profile && !androidProfile) {
    return;
  }

  const RNFS = await import('@rabby-wallet/react-native-fs');
  const baseDir = RNFS.default.ExternalDirectoryPath;
  if (!baseDir) {
    console.info('[RabbyStartupProfiler] missing external directory');
    return;
  }

  const timestamp = Date.now();
  const basePath = `${baseDir}/${PROFILE_FILE_PREFIX}-${timestamp}`;

  if (profile) {
    await RNFS.default.writeFile(`${basePath}.cpuprofile`, profile, 'utf8');
    console.info('[RabbyStartupProfiler] hermes_profile_saved', {
      path: `${basePath}.cpuprofile`,
      bytes: profile.length,
    });
  }

  if (androidProfile) {
    const content = JSON.stringify(androidProfile);
    await RNFS.default.writeFile(`${basePath}.android-profile.json`, content, 'utf8');
    console.info('[RabbyStartupProfiler] android_profile_saved', {
      path: `${basePath}.android-profile.json`,
      bytes: content.length,
    });
  }
}

export function startHermesStartupProfiler() {
  if (
    didStartStartupProfiler ||
    Platform.OS !== 'android' ||
    !isStartupProfilerEnabled
  ) {
    return;
  }

  didStartStartupProfiler = true;
  setStartupProfilerActiveUntil(
    Date.now() + PROFILE_WINDOW_MS + PROFILE_WORKER_DEFER_EXTRA_MS,
  );

  const sentryProfiler = getSentryProfilerModule();
  if (typeof sentryProfiler?.startProfiling !== 'function') {
    setStartupProfilerActiveUntil(0);
    console.info('[RabbyStartupProfiler] sentry_profiler_unavailable');
    return;
  }

  try {
    traceStartupProfilerInstant('js.hermes_startup_profile.start');
    const started = sentryProfiler.startProfiling(true);
    console.info('[RabbyStartupProfiler] start', started);
    if (started?.started === false) {
      setStartupProfilerActiveUntil(0);
      return;
    }

    setTimeout(() => {
      try {
        traceStartupProfilerInstant('js.hermes_startup_profile.stop');
        const stopped = sentryProfiler.stopProfiling?.();
        setStartupProfilerActiveUntil(0);
        if (stopped?.error) {
          console.info('[RabbyStartupProfiler] stop_error', stopped.error);
        }

        persistStartupProfile(
          stopped?.profile,
          stopped?.androidProfile || stopped?.nativeProfile,
        ).catch(error => {
          console.info(
            '[RabbyStartupProfiler] persist_error',
            error instanceof Error ? error.message : String(error),
          );
        });
      } catch (error) {
        setStartupProfilerActiveUntil(0);
        console.info(
          '[RabbyStartupProfiler] stop_throw',
          error instanceof Error ? error.message : String(error),
        );
      }
    }, PROFILE_WINDOW_MS);
  } catch (error) {
    setStartupProfilerActiveUntil(0);
    console.info(
      '[RabbyStartupProfiler] start_throw',
      error instanceof Error ? error.message : String(error),
    );
  }
}

startHermesStartupProfiler();
