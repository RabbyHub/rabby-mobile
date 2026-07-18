import { StackActions } from '@react-navigation/native';

import { RootNames } from '@/constant/layout';
import { apisLock } from '@/core/apis';
import accountStore from '@/store/account';
import { navigationRef } from '@/utils/navigation';

import { REGRESSION_DEFAULT_PASSWORD } from '../credentials.nonprod';
import { getRegressionScenarioRuntimeSnapshot } from '../runtime.nonprod';
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
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = getRegressionScenarioRuntimeSnapshot();
    const event = [...snapshot.events].reverse().find(item => {
      const data = item.data as
        | {
            assertion?: unknown;
            passed?: unknown;
          }
        | undefined;
      return (
        item.runId === context.command.runId &&
        item.name === 'assertion' &&
        data?.assertion === assertion &&
        data?.passed === true
      );
    });

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
