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

export async function waitForScenarioAssertion(
  context: RegressionScenarioExecutionContext,
  assertion: string,
  timeoutMs = 30_000,
  afterTimestamp = 0,
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
        item.timestamp >= afterTimestamp &&
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
