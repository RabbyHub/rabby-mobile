import {
  getHomeEntryReady,
  resetHomeStartupMilestonesForTests,
} from '@/core/utils/homeStartupMilestones';
import {
  resolveWalletEntryDestination,
  type WalletEntryDestination,
} from '@/core/utils/walletEntryState';
import { getAppLockStateSnapshot, storeApiLock } from '@/hooks/appLockState';
import {
  runStartupTask,
  type StartupTaskHandle,
} from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import {
  getAppBootstrapStateSnapshot,
  setAppCouldRender,
} from './appBootstrapState';
import { runAppStateBootstrap } from './appStateBootstrap';
import {
  createLaunchTaskDefinitions,
  registerLaunchTaskDefinitions,
} from './launchTaskDefinitions';
import { createLaunchPhaseController } from './launchPhaseController';
import type { LaunchTaskLoaderCatalog } from './moduleLoading/launchTaskContracts';
import { createStartupPhaseRegistry } from './phaseRegistry';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolve = () => undefined;
  const promise = new Promise<void>(release => {
    resolve = release;
  });
  return { promise, resolve };
}

async function flushMicrotasks(rounds = 12) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
}

function getCurrentEntryDestination(): WalletEntryDestination | null {
  const state = getAppLockStateSnapshot();
  return resolveWalletEntryDestination({
    accountState: state.accountState,
    isAppUnlocked: state.appUnlocked,
    isUnlockSessionValid: state.isUnlockSessionValid,
  });
}

function createBoundaryLoaders(events: string[]): LaunchTaskLoaderCatalog {
  return {
    lockUnlockEventBridge: async () => ({
      startLockUnlockEventBridge: () => events.push('launch:lock-bridge'),
    }),
    bootstrapI18nReady: async () => ({
      startSubscribeLangChange: () => events.push('launch:i18n'),
    }),
    appTimeoutAutoLockHydrate: async () => ({
      startAppTimeoutAutoLockHydration: async () => {
        events.push('launch:auto-lock');
      },
    }),
    appSettingsAutoLockHydrate: async () => ({
      startAppSettingsAutoLockHydration: () =>
        events.push('launch:app-settings'),
    }),
    biometricsSystemAuthAvailability: async () => ({
      startBiometricsSystemAuthAvailabilityHydration: () =>
        events.push('launch:biometrics'),
    }),
    globalNetworkPolling: async () => ({
      startGlobalNetworkPolling: () => events.push('launch:network'),
    }),
    homePreSplashLocalStateWarmup: async () => ({
      warmHomePreSplashLocalState: () => events.push('launch:home-local'),
    }),
    computationWorkerPrewarm: async () => ({
      requestComputationThreadStart: () => events.push('launch:worker'),
    }),
    transactionWatchersStart: async () => ({
      ensureServiceApiReady: async () => undefined,
    }),
    syncChainMetadataWarmup: async () => ({
      ensureSyncChainServiceReady: async () => undefined,
    }),
  };
}

describe('minimal App shell integration', () => {
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    setAppCouldRender(false);
    resetHomeStartupMilestonesForTests();
    storeApiLock.setAppLock({
      appUnlocked: false,
      isUnlockSessionValid: false,
      hasVisibleAccounts: false,
      hasStoredKeyrings: false,
      accountState: 'checking',
      pwdStatus: -1,
    });
  });

  afterEach(() => {
    setAppCouldRender(false);
    resetHomeStartupMilestonesForTests();
    consoleInfoSpy.mockRestore();
  });

  it('starts launch work immediately but publishes Home only after app state converges', async () => {
    const events: string[] = [];
    const deferredHandles: StartupTaskHandle[] = [];
    const lockStateGate = createDeferred();
    const securityChainGate = createDeferred();
    const phaseRegistry = createStartupPhaseRegistry();
    const definitions = createLaunchTaskDefinitions(
      createBoundaryLoaders(events),
    );

    registerLaunchTaskDefinitions(definitions, {
      registerPhaseTask: phaseRegistry.registerStartupPhaseTask,
      scheduleTask: (run, taskKey) => {
        const result = runStartupTask(run, STARTUP_TASKS[taskKey]);
        if (
          result &&
          typeof result === 'object' &&
          'cancel' in result &&
          typeof result.cancel === 'function'
        ) {
          deferredHandles.push(result);
        }
      },
    });

    const launchController = createLaunchPhaseController({
      advanceStartupPhase: phaseRegistry.advanceStartupPhase,
      startPerformanceRecording: reason => {
        events.push(`performance:${reason}`);
      },
    });

    try {
      launchController.startLaunchPhase('integration_app_shell');
      const bootstrapPromise = runAppStateBootstrap({
        loadInitialLockState: async () => {
          events.push('bootstrap:lock-started');
          await lockStateGate.promise;
          storeApiLock.setAppLock(previous => ({
            ...previous,
            appUnlocked: false,
            isUnlockSessionValid: true,
            hasVisibleAccounts: true,
            hasStoredKeyrings: true,
            accountState: 'available',
          }));
          events.push('bootstrap:lock-ready');
          return getAppLockStateSnapshot();
        },
        loadSecurityChain: async () => {
          events.push('bootstrap:security-started');
          await securityChainGate.promise;
          events.push('bootstrap:security-ready');
        },
        tryAutoUnlock: async () => {
          events.push('bootstrap:auto-unlock');
        },
      });

      await flushMicrotasks();

      expect(events).toEqual(
        expect.arrayContaining([
          'performance:integration_app_shell',
          'launch:lock-bridge',
          'launch:i18n',
          'launch:auto-lock',
          'launch:home-local',
          'bootstrap:lock-started',
          'bootstrap:security-started',
        ]),
      );
      expect(getAppBootstrapStateSnapshot()).toEqual({ couldRender: false });
      expect(getCurrentEntryDestination()).toBeNull();
      expect(getHomeEntryReady()).toBe(false);

      lockStateGate.resolve();
      await flushMicrotasks();
      expect(events).toContain('bootstrap:lock-ready');
      expect(getAppBootstrapStateSnapshot()).toEqual({ couldRender: false });
      expect(getHomeEntryReady()).toBe(false);

      securityChainGate.resolve();
      await expect(bootstrapPromise).resolves.toEqual({
        initialLockStatus: 'fulfilled',
        securityChainStatus: 'fulfilled',
        unlockStatus: 'deferred',
        shouldWaitAutoUnlock: false,
        homeEntryReady: true,
      });

      expect(events).not.toContain('bootstrap:auto-unlock');
      expect(getAppBootstrapStateSnapshot()).toEqual({ couldRender: true });
      expect(getCurrentEntryDestination()).toBe('Home');
      expect(getHomeEntryReady()).toBe(true);
    } finally {
      deferredHandles.forEach(handle => handle.cancel());
    }
  });
});
