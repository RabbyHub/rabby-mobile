import {
  getAppLockStateSnapshot,
  type AppLockState,
} from '@/hooks/appLockState';
import { markHomeEntryReadyIfEligible } from '@/core/utils/homeStartupMilestones';
import { setAppCouldRender } from './appBootstrapState';

type AppStateBootstrapDependencies = {
  loadInitialLockState: () => Promise<AppLockState>;
  loadSecurityChain: () => unknown | Promise<unknown>;
  tryAutoUnlock: () => Promise<unknown>;
  onReady?: (result: AppStateBootstrapSettledResult) => void;
};

type AppStateBootstrapSettledResult = {
  initialLockStatus: PromiseSettledResult<AppLockState>['status'];
  securityChainStatus: PromiseSettledResult<unknown>['status'];
  unlockStatus: PromiseSettledResult<unknown>['status'] | 'deferred';
  shouldWaitAutoUnlock: boolean;
};

export type AppStateBootstrapResult = AppStateBootstrapSettledResult & {
  homeEntryReady: boolean;
};

function callAsPromise<T>(call: () => T | Promise<T>) {
  try {
    return Promise.resolve(call());
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Runs the production app-state bootstrap without requiring a mounted React
 * tree. Platform adapters own I/O; this function owns readiness semantics.
 */
export async function runAppStateBootstrap(
  dependencies: AppStateBootstrapDependencies,
): Promise<AppStateBootstrapResult> {
  const [initialLockResult, securityChainResult] = await Promise.allSettled([
    callAsPromise(dependencies.loadInitialLockState),
    callAsPromise(dependencies.loadSecurityChain),
  ]);
  const initialLockState =
    initialLockResult.status === 'fulfilled' ? initialLockResult.value : null;
  const shouldWaitAutoUnlock =
    initialLockResult.status !== 'fulfilled' ||
    (!initialLockState?.appUnlocked && !initialLockState?.isUnlockSessionValid);
  const unlockResult = shouldWaitAutoUnlock
    ? await Promise.allSettled([
        callAsPromise(dependencies.tryAutoUnlock),
      ]).then(([result]) => result)
    : null;
  const settledResult: AppStateBootstrapSettledResult = {
    initialLockStatus: initialLockResult.status,
    securityChainStatus: securityChainResult.status,
    unlockStatus: unlockResult?.status ?? 'deferred',
    shouldWaitAutoUnlock,
  };

  dependencies.onReady?.(settledResult);

  const homeEntryReady = markHomeEntryReadyIfEligible(
    getAppLockStateSnapshot(),
    shouldWaitAutoUnlock
      ? 'bootstrap_auto_unlock_ready'
      : 'bootstrap_session_ready',
  );

  setAppCouldRender(true);

  return {
    ...settledResult,
    homeEntryReady,
  };
}
