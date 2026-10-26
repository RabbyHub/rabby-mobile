import { createStore } from 'zustand/vanilla';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: () => undefined,
}));

// This integration test intentionally verifies the real registry lifecycle.
/* eslint-disable no-runtime-service-imports */
import {
  ensureCoreService,
  isCoreServiceLoaded,
  registerCoreServiceLoader,
  registerService,
  type CoreServiceName,
  type CoreServiceRegistry,
} from '@/core/services/serviceRegistry';
/* eslint-enable no-runtime-service-imports */
import {
  getHomeContentReady,
  getHomeEntryReady,
  markHomeContentReady,
  markHomeEntryReadyIfEligible,
  resetHomeStartupMilestonesForTests,
} from '@/core/utils/homeStartupMilestones';
import {
  getHomePostStartupReady,
  getHomeStartupReady,
  resetHomeStartupReady,
  scheduleHomeStartupReady,
} from '@/core/utils/homeStartupReady';
import {
  runStartupTask,
  type StartupTaskHandle,
} from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
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

type LifecycleState = {
  accountContextReady: boolean;
  contentReady: boolean;
  onDemandReady: boolean;
};

const EXPECTED_LAUNCH_TASK_LABELS = [
  'lock.unlockEventBridge',
  'setup.runtimeSecuritySubscriptions',
  'bootstrap.i18nReady',
  'appTimeout.autoLockHydrate',
  'appSettings.autoLockHydrate',
  'biometrics.systemAuthAvailability',
  'network.globalPolling',
  'home.preSplashLocalStateWarmup',
  'computation.workerPrewarm',
  'customTestnet.snapshotHydration',
  'transaction.watchersStart',
  'chain.syncMetadataWarmup',
];

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

function registerGatedService<Name extends CoreServiceName>(
  name: Name,
  service: CoreServiceRegistry[Name],
  events: string[],
) {
  const gate = createDeferred();
  let unregisterService: (() => void) | undefined;
  const unregisterLoader = registerCoreServiceLoader(name, async () => {
    events.push(`${name}:loader-started`);
    await gate.promise;
    unregisterService = registerService(name, service);
    events.push(`${name}:registered`);
  });

  return {
    release: gate.resolve,
    unregister: () => {
      unregisterService?.();
      unregisterLoader();
    },
  };
}

function createBoundaryLoaders(events: string[]): LaunchTaskLoaderCatalog {
  return {
    lockUnlockEventBridge: async () => ({
      startLockUnlockEventBridge: () => {
        events.push('lock:started');
      },
    }),
    setupRuntimeSecuritySubscriptions: async () => ({
      startSetupRuntimeSecuritySubscriptions: () => {
        events.push('security:started');
      },
    }),
    bootstrapI18nReady: async () => ({
      startSubscribeLangChange: () => {
        events.push('i18n:started');
      },
    }),
    appTimeoutAutoLockHydrate: async () => ({
      startAppTimeoutAutoLockHydration: async () => {
        events.push('app-timeout:hydrated');
      },
    }),
    appSettingsAutoLockHydrate: async () => ({
      startAppSettingsAutoLockHydration: () => {
        events.push('app-settings:hydrated');
      },
    }),
    biometricsSystemAuthAvailability: async () => ({
      startBiometricsSystemAuthAvailabilityHydration: () => {
        events.push('biometrics:hydrated');
      },
    }),
    globalNetworkPolling: async () => ({
      startGlobalNetworkPolling: () => {
        events.push('network:started');
      },
    }),
    homePreSplashLocalStateWarmup: async () => ({
      warmHomePreSplashLocalState: () => {
        events.push('home-local-state:warmed');
      },
    }),
    computationWorkerPrewarm: async () => ({
      requestComputationThreadStart: reason => {
        events.push(`worker:${reason}`);
      },
    }),
    customTestnetSnapshotHydration: async () => ({
      ensureCustomTestnetStoreHydrated: async () => {
        events.push('custom-testnet:snapshot-hydrated');
      },
    }),
    transactionWatchersStart: async () => ({
      ensureServiceApiReady: serviceName => {
        events.push(`${serviceName}:requested`);
        return ensureCoreService(serviceName);
      },
    }),
    syncChainMetadataWarmup: async () => ({
      ensureSyncChainServiceReady: () => {
        events.push('syncChainService:requested');
        return ensureCoreService('syncChainService');
      },
    }),
  };
}

describe.each([
  {
    name: 'manual unlock',
    readiness: {
      appUnlocked: true,
      isUnlockSessionValid: false,
      hasVisibleAccounts: true,
    },
  },
  {
    name: 'valid unlocked session',
    readiness: {
      appUnlocked: false,
      isUnlockSessionValid: true,
      hasVisibleAccounts: true,
    },
  },
])('startup lifecycle integration: $name', ({ name, readiness }) => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    resetHomeStartupReady();
    resetHomeStartupMilestonesForTests();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('moves from launch registration to usable Home without releasing deferred work early', async () => {
    const events: string[] = [];
    const lifecycleStore = createStore<LifecycleState>(() => ({
      accountContextReady: false,
      contentReady: false,
      onDemandReady: false,
    }));
    const phaseRegistry = createStartupPhaseRegistry();
    const keyring = registerGatedService(
      'keyringService',
      {} as CoreServiceRegistry['keyringService'],
      events,
    );
    const transactionWatcher = registerGatedService(
      'transactionWatcherService',
      {} as CoreServiceRegistry['transactionWatcherService'],
      events,
    );
    const transactionBroadcastWatcher = registerGatedService(
      'transactionBroadcastWatcherService',
      {} as CoreServiceRegistry['transactionBroadcastWatcherService'],
      events,
    );
    const syncChain = registerGatedService(
      'syncChainService',
      {} as CoreServiceRegistry['syncChainService'],
      events,
    );

    try {
      const launchDefinitions = createLaunchTaskDefinitions(
        createBoundaryLoaders(events),
      );
      registerLaunchTaskDefinitions(launchDefinitions, {
        registerPhaseTask: phaseRegistry.registerStartupPhaseTask,
        scheduleTask: (run, taskKey) => {
          runStartupTask(run, STARTUP_TASKS[taskKey]);
        },
      });

      runStartupTask(
        async () => {
          await ensureCoreService('keyringService');
          lifecycleStore.setState({ accountContextReady: true });
        },
        {
          label: 'integration.homeAccountContext',
          owner: 'integration-test',
          reason: 'prove entry readiness waits for its service dependency',
          stage: 'homeEntryReady',
          priority: 'critical',
        },
      );
      runStartupTask(
        () => {
          lifecycleStore.setState({ contentReady: true });
        },
        {
          label: 'integration.homeContent',
          owner: 'integration-test',
          reason: 'prove content work waits for the content milestone',
          stage: 'homeContentReady',
          priority: 'normal',
        },
      );
      const onDemandHandle = runStartupTask(
        () => {
          lifecycleStore.setState({ onDemandReady: true });
        },
        {
          label: 'integration.onDemandFeature',
          owner: 'integration-test',
          reason: 'prove feature work remains dormant until requested',
          stage: 'onDemand',
          priority: 'normal',
        },
      ) as StartupTaskHandle;

      const launchController = createLaunchPhaseController({
        advanceStartupPhase: phaseRegistry.advanceStartupPhase,
        startPerformanceRecording: reason => {
          events.push(`performance:${reason}`);
        },
      });

      expect(
        phaseRegistry.getStartupPhaseSnapshot('launch').registeredTaskIds,
      ).toEqual(EXPECTED_LAUNCH_TASK_LABELS);
      expect(lifecycleStore.getState()).toEqual({
        accountContextReady: false,
        contentReady: false,
        onDemandReady: false,
      });

      launchController.startLaunchPhase(`integration_${name}`);
      await flushMicrotasks();

      expect(phaseRegistry.getStartupPhaseSnapshot('launch')).toEqual({
        advancedReason: `integration_${name}`,
        registeredTaskIds: EXPECTED_LAUNCH_TASK_LABELS,
      });
      expect(events).toEqual(
        expect.arrayContaining([
          `performance:integration_${name}`,
          'lock:started',
          'security:started',
          'i18n:started',
          'app-timeout:hydrated',
          'app-settings:hydrated',
          'biometrics:hydrated',
          'network:started',
          'home-local-state:warmed',
          'worker:startup_prewarm',
        ]),
      );
      expect(events).not.toContain('transactionWatcherService:requested');
      expect(events).not.toContain('syncChainService:requested');

      expect(
        markHomeEntryReadyIfEligible(
          {
            appUnlocked: true,
            isUnlockSessionValid: true,
            hasVisibleAccounts: false,
          },
          'no_visible_accounts',
        ),
      ).toBe(false);
      expect(
        markHomeEntryReadyIfEligible(
          {
            appUnlocked: false,
            isUnlockSessionValid: false,
            hasVisibleAccounts: true,
          },
          'locked_session',
        ),
      ).toBe(false);
      expect(getHomeEntryReady()).toBe(false);

      expect(markHomeEntryReadyIfEligible(readiness, name)).toBe(true);
      await flushMicrotasks();
      expect(events).toContain('keyringService:loader-started');
      expect(events).not.toContain('custom-testnet:snapshot-hydrated');
      expect(lifecycleStore.getState().accountContextReady).toBe(false);

      keyring.release();
      await flushMicrotasks();
      expect(isCoreServiceLoaded('keyringService')).toBe(true);
      expect(lifecycleStore.getState().accountContextReady).toBe(true);

      const cancelHomeReadiness = scheduleHomeStartupReady();
      await jest.advanceTimersByTimeAsync(1000);
      await flushMicrotasks();

      expect(getHomeStartupReady()).toBe(true);
      expect(getHomePostStartupReady()).toBe(true);
      expect(events).toContain('custom-testnet:snapshot-hydrated');
      expect(events).toEqual(
        expect.arrayContaining([
          'transactionWatcherService:requested',
          'transactionBroadcastWatcherService:requested',
          'syncChainService:requested',
        ]),
      );
      expect(isCoreServiceLoaded('transactionWatcherService')).toBe(false);
      expect(isCoreServiceLoaded('syncChainService')).toBe(false);

      transactionWatcher.release();
      transactionBroadcastWatcher.release();
      syncChain.release();
      await flushMicrotasks();

      expect(isCoreServiceLoaded('transactionWatcherService')).toBe(true);
      expect(isCoreServiceLoaded('transactionBroadcastWatcherService')).toBe(
        true,
      );
      expect(isCoreServiceLoaded('syncChainService')).toBe(true);
      expect(getHomeContentReady()).toBe(false);
      expect(lifecycleStore.getState().contentReady).toBe(false);

      markHomeContentReady('integration_content_settled');
      expect(getHomeContentReady()).toBe(true);
      expect(lifecycleStore.getState().contentReady).toBe(true);
      expect(lifecycleStore.getState().onDemandReady).toBe(false);

      onDemandHandle.run?.();
      expect(lifecycleStore.getState().onDemandReady).toBe(true);
      cancelHomeReadiness();
    } finally {
      keyring.unregister();
      transactionWatcher.unregister();
      transactionBroadcastWatcher.unregister();
      syncChain.unregister();
    }
  });
});
