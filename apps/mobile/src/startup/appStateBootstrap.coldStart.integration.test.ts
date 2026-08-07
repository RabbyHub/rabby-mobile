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
import {
  markBootstrapAccountsAdded,
  runAppStateBootstrap,
} from './appStateBootstrap';

type BootstrapScenarioName =
  | 'manual-unlock'
  | 'valid-session'
  | 'no-account'
  | 'auto-unlock-failure'
  | 'security-chain-failure';

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
  autoUnlockState?: Pick<AppLockState, 'appUnlocked' | 'isUnlockSessionValid'>;
  shouldWaitAutoUnlock: boolean;
  autoUnlockRejects?: boolean;
  securityChainRejects?: boolean;
  expectedHomeEntryReady: boolean;
  addAccountAfterBootstrap?: boolean;
};

const scenarios: Record<BootstrapScenarioName, BootstrapScenario> = {
  'manual-unlock': {
    initialState: {
      appUnlocked: false,
      isUnlockSessionValid: false,
      hasVisibleAccounts: true,
      hasStoredKeyrings: true,
    },
    autoUnlockState: {
      appUnlocked: true,
      isUnlockSessionValid: true,
    },
    shouldWaitAutoUnlock: true,
    expectedHomeEntryReady: true,
  },
  'valid-session': {
    initialState: {
      appUnlocked: false,
      isUnlockSessionValid: true,
      hasVisibleAccounts: true,
      hasStoredKeyrings: true,
    },
    shouldWaitAutoUnlock: false,
    expectedHomeEntryReady: true,
  },
  'no-account': {
    initialState: {
      appUnlocked: true,
      isUnlockSessionValid: false,
      hasVisibleAccounts: false,
      hasStoredKeyrings: false,
    },
    shouldWaitAutoUnlock: false,
    expectedHomeEntryReady: false,
    addAccountAfterBootstrap: true,
  },
  'auto-unlock-failure': {
    initialState: {
      appUnlocked: false,
      isUnlockSessionValid: false,
      hasVisibleAccounts: true,
      hasStoredKeyrings: true,
    },
    shouldWaitAutoUnlock: true,
    autoUnlockRejects: true,
    expectedHomeEntryReady: false,
  },
  'security-chain-failure': {
    initialState: {
      appUnlocked: false,
      isUnlockSessionValid: true,
      hasVisibleAccounts: true,
      hasStoredKeyrings: true,
    },
    shouldWaitAutoUnlock: false,
    securityChainRejects: true,
    expectedHomeEntryReady: true,
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
        if (scenario.securityChainRejects) {
          events.push('security-chain:failed');
          throw new Error('integration security-chain failure');
        }
        events.push('security-chain:loaded');
      },
      tryAutoUnlock: async () => {
        events.push('auto-unlock:started');
        if (scenario.autoUnlockRejects) {
          events.push('auto-unlock:failed');
          throw new Error('integration auto-unlock failure');
        }
        if (scenario.autoUnlockState) {
          storeApiLock.setAppLock(previous => ({
            ...previous,
            ...scenario.autoUnlockState,
          }));
        }
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
      securityChainStatus: scenario.securityChainRejects
        ? 'rejected'
        : 'fulfilled',
      unlockStatus: scenario.shouldWaitAutoUnlock
        ? scenario.autoUnlockRejects
          ? 'rejected'
          : 'fulfilled'
        : 'deferred',
      shouldWaitAutoUnlock: scenario.shouldWaitAutoUnlock,
      homeEntryReady: scenario.expectedHomeEntryReady,
    });
    expect(events.includes('auto-unlock:started')).toBe(
      scenario.shouldWaitAutoUnlock,
    );
    expect(getAppLockStateSnapshot()).toEqual(
      expect.objectContaining({
        ...scenario.initialState,
        ...(scenario.autoUnlockRejects ? {} : scenario.autoUnlockState),
      }),
    );
    expect(getHomeEntryReady()).toBe(scenario.expectedHomeEntryReady);
    expect(homeReadyCallbacks).toBe(scenario.expectedHomeEntryReady ? 1 : 0);
    expect(getAppBootstrapStateSnapshot()).toEqual({ couldRender: true });

    if (scenario.addAccountAfterBootstrap) {
      expect(markBootstrapAccountsAdded(0)).toBe(false);
      expect(getHomeEntryReady()).toBe(false);

      expect(markBootstrapAccountsAdded(1)).toBe(true);
      expect(getAppLockStateSnapshot()).toEqual(
        expect.objectContaining({
          hasVisibleAccounts: true,
          hasStoredKeyrings: true,
        }),
      );
      expect(getHomeEntryReady()).toBe(true);
      expect(homeReadyCallbacks).toBe(1);
    }

    cancelHomeReadySubscription();
  });
});
