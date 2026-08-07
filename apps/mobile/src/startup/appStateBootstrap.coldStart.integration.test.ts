import {
  getAppLockStateSnapshot,
  storeApiLock,
  type AppLockState,
} from '@/hooks/appLockState';
import {
  getHomeEntryReady,
  runAfterHomeEntryReady,
} from '@/core/utils/homeStartupMilestones';
import { getAppBootstrapStateSnapshot } from './appBootstrapState';
import { runAppStateBootstrap } from './appStateBootstrap';

type BootstrapScenarioName = 'manual-unlock' | 'valid-session';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

type BootstrapScenario = {
  initialState: Pick<
    AppLockState,
    | 'appUnlocked'
    | 'isUnlockSessionValid'
    | 'hasVisibleAccounts'
    | 'hasStoredKeyrings'
  >;
  unlockedState: Pick<AppLockState, 'appUnlocked' | 'isUnlockSessionValid'>;
  shouldWaitAutoUnlock: boolean;
};

const scenarios: Record<BootstrapScenarioName, BootstrapScenario> = {
  'manual-unlock': {
    initialState: {
      appUnlocked: false,
      isUnlockSessionValid: false,
      hasVisibleAccounts: true,
      hasStoredKeyrings: true,
    },
    unlockedState: {
      appUnlocked: true,
      isUnlockSessionValid: true,
    },
    shouldWaitAutoUnlock: true,
  },
  'valid-session': {
    initialState: {
      appUnlocked: false,
      isUnlockSessionValid: true,
      hasVisibleAccounts: true,
      hasStoredKeyrings: true,
    },
    unlockedState: {
      appUnlocked: false,
      isUnlockSessionValid: true,
    },
    shouldWaitAutoUnlock: false,
  },
};

function createDeferred(): Deferred {
  let resolve = () => undefined;
  const promise = new Promise<void>(release => {
    resolve = release;
  });
  return { promise, resolve };
}

async function flushMicrotasks(rounds = 6) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
}

describe.each(
  Object.entries(scenarios) as [BootstrapScenarioName, BootstrapScenario][],
)('app-state cold start integration: %s', (_scenarioName, scenario) => {
  it('publishes Home only after lock and security state have converged', async () => {
    const lockStateGate = createDeferred();
    const securityChainGate = createDeferred();
    const events: string[] = [];
    let homeReadyCallbacks = 0;
    const cancelHomeReadySubscription = runAfterHomeEntryReady(() => {
      homeReadyCallbacks += 1;
    });

    expect(getAppBootstrapStateSnapshot()).toEqual({ couldRender: false });
    expect(getHomeEntryReady()).toBe(false);

    const bootstrapPromise = runAppStateBootstrap({
      loadInitialLockState: async () => {
        events.push('lock-state:started');
        await lockStateGate.promise;
        storeApiLock.setAppLock(previous => ({
          ...previous,
          ...scenario.initialState,
        }));
        events.push('lock-state:loaded');
        return getAppLockStateSnapshot();
      },
      loadSecurityChain: async () => {
        events.push('security-chain:started');
        await securityChainGate.promise;
        events.push('security-chain:loaded');
      },
      tryAutoUnlock: async () => {
        events.push('auto-unlock:started');
        storeApiLock.setAppLock(previous => ({
          ...previous,
          ...scenario.unlockedState,
        }));
        events.push('auto-unlock:finished');
      },
    });

    await flushMicrotasks();
    expect(events).toEqual(['lock-state:started', 'security-chain:started']);
    expect(getAppBootstrapStateSnapshot().couldRender).toBe(false);
    expect(getHomeEntryReady()).toBe(false);

    lockStateGate.resolve();
    await flushMicrotasks();
    expect(events).toContain('lock-state:loaded');
    expect(getAppBootstrapStateSnapshot().couldRender).toBe(false);

    securityChainGate.resolve();
    const result = await bootstrapPromise;

    expect(result).toEqual({
      initialLockStatus: 'fulfilled',
      securityChainStatus: 'fulfilled',
      unlockStatus: scenario.shouldWaitAutoUnlock ? 'fulfilled' : 'deferred',
      shouldWaitAutoUnlock: scenario.shouldWaitAutoUnlock,
      homeEntryReady: true,
    });
    expect(events.includes('auto-unlock:started')).toBe(
      scenario.shouldWaitAutoUnlock,
    );
    expect(getAppLockStateSnapshot()).toEqual(
      expect.objectContaining({
        ...scenario.initialState,
        ...scenario.unlockedState,
      }),
    );
    expect(getHomeEntryReady()).toBe(true);
    expect(homeReadyCallbacks).toBe(1);
    expect(getAppBootstrapStateSnapshot()).toEqual({ couldRender: true });

    cancelHomeReadySubscription();
  });
});
