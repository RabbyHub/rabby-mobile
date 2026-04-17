import { Platform } from 'react-native';
import { zCreate } from '@/core/utils/reexports';
import { logger } from '@/utils/logger';
import { isNonPublicProductionEnv } from '@/constant/package';
import { useShallow } from 'zustand/react/shallow';
import { getStartupProbeEnabledOnNextLaunch } from '@/hooks/appSettings';

export const STARTUP_PROBE_ENABLED =
  Platform.OS === 'android' &&
  isNonPublicProductionEnv &&
  getStartupProbeEnabledOnNextLaunch();

type StartupProbeFlags = {
  jsEntryLoaded: boolean;
  appMounted: boolean;
  appRootLayout: boolean;
  mainScreenMounted: boolean;
  bootstrapStarted: boolean;
  bootstrapCouldRender: boolean;
  appNavigationMounted: boolean;
  appNavigationReady: boolean;
  splashHideCalled: boolean;
  lockInfoBootstrapStarted: boolean;
  lockInfoBootstrapSettled: boolean;
  unlockMounted: boolean;
  unlockLayout: boolean;
  unlockFocused: boolean;
  firstSafeUnlockFrame: boolean;
};

type StartupProbeEvent = {
  id: number;
  stage: string;
  elapsedMs: number;
  summary: string;
};

type StartupProbeState = {
  enabled: boolean;
  launchAt: number;
  lastEvent: StartupProbeEvent | null;
  events: StartupProbeEvent[];
  flags: StartupProbeFlags;
};

const STARTUP_PROBE_MAX_EVENTS = 8;
const startupProbeLaunchAt = Date.now();
let startupProbeEventId = 0;
const emittedStartupProbeStages = new Set<string>();

const startupProbeStore = zCreate<StartupProbeState>(() => ({
  enabled: STARTUP_PROBE_ENABLED,
  launchAt: startupProbeLaunchAt,
  lastEvent: null,
  events: [],
  flags: {
    jsEntryLoaded: false,
    appMounted: false,
    appRootLayout: false,
    mainScreenMounted: false,
    bootstrapStarted: false,
    bootstrapCouldRender: false,
    appNavigationMounted: false,
    appNavigationReady: false,
    splashHideCalled: false,
    lockInfoBootstrapStarted: false,
    lockInfoBootstrapSettled: false,
    unlockMounted: false,
    unlockLayout: false,
    unlockFocused: false,
    firstSafeUnlockFrame: false,
  },
}));

function formatStartupProbeValue(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function formatStartupProbeSummary(payload?: Record<string, unknown>) {
  if (!payload) return '';

  const parts = Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatStartupProbeValue(value)}`);

  return parts.join(' ');
}

function getStartupProbeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function recordStartupProbe(
  stage: string,
  options?: {
    payload?: Record<string, unknown>;
    flags?: Partial<StartupProbeFlags>;
    level?: 'debug' | 'info' | 'warn' | 'error';
  },
) {
  if (!STARTUP_PROBE_ENABLED) return;

  const elapsedMs = Date.now() - startupProbeLaunchAt;
  const summary = formatStartupProbeSummary(options?.payload);
  const event: StartupProbeEvent = {
    id: ++startupProbeEventId,
    stage,
    elapsedMs,
    summary,
  };

  startupProbeStore.setState(prev => ({
    ...prev,
    lastEvent: event,
    events: [...prev.events.slice(-(STARTUP_PROBE_MAX_EVENTS - 1)), event],
    flags: {
      ...prev.flags,
      ...options?.flags,
    },
  }));

  const logPayload = {
    stage,
    elapsedMs,
    ...(options?.payload || {}),
  };

  logger.info('[startup-probe]', logPayload);

  const consoleMethod =
    options?.level === 'warn'
      ? console.warn
      : options?.level === 'error'
      ? console.error
      : console.debug;

  consoleMethod('[startup-probe]', logPayload);
}

export function recordStartupProbeOnce(
  stage: string,
  options?: Parameters<typeof recordStartupProbe>[1],
) {
  if (!STARTUP_PROBE_ENABLED) return;
  if (emittedStartupProbeStages.has(stage)) return;

  emittedStartupProbeStages.add(stage);
  recordStartupProbe(stage, options);
}

export function trackStartupProbePromise<T>(name: string, promise: Promise<T>) {
  if (!STARTUP_PROBE_ENABLED) return promise;

  const startedAt = Date.now();
  recordStartupProbe('BOOTSTRAP_TASK_START', {
    payload: { task: name },
  });

  return promise.then(
    result => {
      recordStartupProbe('BOOTSTRAP_TASK_DONE', {
        payload: {
          task: name,
          durationMs: Date.now() - startedAt,
        },
      });
      return result;
    },
    error => {
      recordStartupProbe('BOOTSTRAP_TASK_FAIL', {
        level: 'warn',
        payload: {
          task: name,
          durationMs: Date.now() - startedAt,
          error: getStartupProbeErrorMessage(error),
        },
      });
      throw error;
    },
  );
}

export function useStartupProbeSnapshot() {
  return startupProbeStore(
    useShallow(s => ({
      enabled: s.enabled,
      launchAt: s.launchAt,
      lastEvent: s.lastEvent,
      events: s.events,
      flags: s.flags,
    })),
  );
}

recordStartupProbeOnce('JS_ENTRY_LOADED', {
  flags: {
    jsEntryLoaded: true,
  },
});
