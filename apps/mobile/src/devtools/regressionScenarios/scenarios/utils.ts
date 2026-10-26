import { StackActions } from '@react-navigation/native';

import { RootNames } from '@/constant/layout';
import { apisLock } from '@/core/apis';
import accountStore from '@/store/account';
import { navigationRef } from '@/utils/navigation';

import { REGRESSION_DEFAULT_PASSWORD } from '../credentials.nonprod';
import { findPassingRegressionScenarioAssertion } from '../runtime.nonprod';
import type { RegressionScenarioExecutionContext } from '../scenarioTypes';

export function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

type ScenarioPerformanceWindowOptions = {
  label: string;
  heartbeatMs?: number;
  warnGapMs?: number;
  maxGapSamples?: number;
  reportEachGap?: boolean;
};

const getScenarioPerfNow = () => {
  const perf = globalThis.performance;
  return typeof perf?.now === 'function' ? perf.now() : Date.now();
};

export function startScenarioPerformanceWindow(
  context: RegressionScenarioExecutionContext,
  {
    label,
    heartbeatMs = 50,
    warnGapMs = 120,
    maxGapSamples = 40,
    reportEachGap = false,
  }: ScenarioPerformanceWindowOptions,
) {
  const startedAt = getScenarioPerfNow();
  let lastTickAt = startedAt;
  let closed = false;
  let sampleCount = 0;
  let gapCount = 0;
  let maxGapMs = 0;
  let totalGapMs = 0;
  const gapSamples: Array<{
    elapsedMs: number;
    gapMs: number;
    stallMs: number;
  }> = [];

  context.report('perf-window-start', {
    label,
    heartbeatMs,
    warnGapMs,
  });

  const timer = setInterval(() => {
    const now = getScenarioPerfNow();
    const gapMs = now - lastTickAt;
    lastTickAt = now;
    sampleCount += 1;
    maxGapMs = Math.max(maxGapMs, gapMs);

    if (gapMs < warnGapMs) {
      return;
    }

    gapCount += 1;
    totalGapMs += gapMs;
    const gapSample = {
      label,
      gapMs: Math.round(gapMs),
      stallMs: Math.round(Math.max(0, gapMs - heartbeatMs)),
      elapsedMs: Math.round(now - startedAt),
    };

    if (gapSamples.length < maxGapSamples) {
      gapSamples.push(gapSample);
    }

    if (reportEachGap) {
      context.report('perf-js-gap', gapSample);
    }
  }, heartbeatMs);

  return {
    mark(name: string, data?: Readonly<Record<string, unknown>>) {
      if (closed) {
        return;
      }
      context.report('perf-mark', {
        label,
        mark: name,
        elapsedMs: Math.round(getScenarioPerfNow() - startedAt),
        ...(data || {}),
      });
    },
    stop(reason = 'complete') {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(timer);
      context.report('perf-window-end', {
        label,
        reason,
        durationMs: Math.round(getScenarioPerfNow() - startedAt),
        sampleCount,
        gapCount,
        maxGapMs: Math.round(maxGapMs),
        totalGapMs: Math.round(totalGapMs),
        gapSamples,
      });
    },
  };
}

export async function waitForScenarioAssertion(
  context: RegressionScenarioExecutionContext,
  assertion: string,
  timeoutMs = 30_000,
  afterTimestamp = 0,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const event = findPassingRegressionScenarioAssertion(
      context.command.runId,
      assertion,
      afterTimestamp,
    );

    if (event) {
      return event;
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for assertion: ${assertion}`);
}

export function parseScenarioBoolean(
  value: string | undefined,
  fallback = false,
) {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export async function startMainRuntimeProfile(
  context: RegressionScenarioExecutionContext,
  {
    label,
    observeMs,
    filePrefix,
    enabledByDefault = false,
  }: {
    label: string;
    observeMs: number;
    filePrefix: string;
    enabledByDefault?: boolean;
  },
) {
  const profileMode = context.command.params.hermesProfile;
  const shouldProfile =
    profileMode?.toLowerCase() === 'main' ||
    parseScenarioBoolean(profileMode, enabledByDefault);
  if (!shouldProfile) {
    return null;
  }

  const profiler = await import('@/core/utils/hermesStartupProfiler');
  const profileWaitMs = Math.min(
    Math.max(Number(context.command.params.profileWaitMs || 12_000), 0),
    15_000,
  );
  const waitStartedAt = Date.now();
  while (
    profiler.isHermesProfilerSessionActive() &&
    Date.now() - waitStartedAt < profileWaitMs
  ) {
    await delay(100);
  }
  if (profiler.isHermesProfilerSessionActive()) {
    throw new Error('Hermes profiler is still occupied by another session');
  }

  const computationThread = await import('@/perfs/thread');
  const workerWasRunning = computationThread.workerThread.isRunning;
  const reasonLabel = label.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  if (workerWasRunning) {
    context.report('perf-mark', {
      label,
      mark: 'main-runtime-profile-worker-stop-start',
    });
    await computationThread.workerThread.terminate();
    await delay(250);
    context.report('perf-mark', {
      label,
      mark: 'main-runtime-profile-worker-stopped',
    });
  }

  const session = profiler.startHermesProfilerSession({
    label: `${label}-${context.command.runId}`,
    expectedDurationMs: Math.min(Math.max(observeMs, 0), 10_000) + 4000,
    filePrefix: `${filePrefix}-${context.command.runId}`,
    includePlatformProfile: parseScenarioBoolean(
      context.command.params.platformProfile,
      true,
    ),
  });

  if (!session) {
    if (workerWasRunning) {
      computationThread.requestComputationThreadStart(
        `${reasonLabel}_profile_start_failed`,
      );
    }
    throw new Error(`Unable to start ${label} Hermes profile`);
  }

  context.report('perf-mark', {
    label,
    mark: 'main-runtime-profile-started',
    workerWasRunning,
  });

  return {
    session,
    restoreWorker() {
      if (workerWasRunning) {
        computationThread.requestComputationThreadStart(
          `${reasonLabel}_profile_complete`,
        );
      }
    },
  };
}

export async function getScenarioAccounts(options?: { force?: boolean }) {
  const accounts = await accountStore.fetchAccounts({
    force: options?.force ?? false,
  });
  if (!accounts.length) {
    throw new Error('Scenario requires at least one visible account');
  }
  return accounts;
}

export async function ensureScenarioWalletUnlocked() {
  if (apisLock.isUnlocked()) {
    return;
  }
  const result = await apisLock.unlockWalletWithUpdateUnlockTime(
    REGRESSION_DEFAULT_PASSWORD,
  );
  if (result.error) {
    throw new Error(`Unable to unlock regression wallet: ${result.error}`);
  }
}

export function pushNestedScreen(
  stack: string,
  screen: string,
  params: Record<string, unknown> = {},
) {
  if (!navigationRef.isReady()) {
    throw new Error('Navigation is not ready');
  }
  navigationRef.dispatch(
    StackActions.push(stack, {
      screen,
      params,
    }),
  );
}

export function resetToHome() {
  if (!navigationRef.isReady()) {
    throw new Error('Navigation is not ready');
  }
  navigationRef.resetRoot({
    index: 0,
    routes: [
      {
        name: RootNames.StackRoot,
        params: {
          screen: RootNames.Home,
        },
      },
    ],
  });
}
