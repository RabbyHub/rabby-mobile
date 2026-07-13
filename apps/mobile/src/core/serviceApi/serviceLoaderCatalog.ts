import {
  registerCoreServiceLoader,
  type CoreServiceName,
} from '@/core/services/serviceRegistry';
import { runOnDemandStartupTask } from '@/core/utils/startupScheduler';
import type {
  StartupTaskOptions,
  StartupTaskPriority,
} from '@/core/utils/startupScheduler';

const CORE_SERVICE_LOADER_NAMES: Record<CoreServiceName, true> = {
  autoConnectService: true,
  bridgeService: true,
  browserHistoryService: true,
  browserService: true,
  contactService: true,
  currencyService: true,
  customRPCService: true,
  customTestnetService: true,
  dappService: true,
  gasAccountService: true,
  hdKeyringService: true,
  keyringService: true,
  lendingService: true,
  metamaskModeService: true,
  notificationService: true,
  offlineChainService: true,
  perpsService: true,
  preferenceService: true,
  rabbyPointsService: true,
  securityEngineService: true,
  sessionService: true,
  swapService: true,
  syncChainService: true,
  transactionBroadcastWatcherService: true,
  transactionHistoryService: true,
  transactionWatcherService: true,
  whitelistService: true,
};

const CORE_SERVICE_LOAD_PRIORITIES: Partial<
  Record<CoreServiceName, StartupTaskPriority>
> = {
  keyringService: 'critical',
  preferenceService: 'critical',
  securityEngineService: 'high',
  transactionHistoryService: 'high',
  notificationService: 'high',
};

const serviceLoadPromises = new Map<CoreServiceName, Promise<void>>();
let catalogRegistered = false;

function getLoaderTaskOptions(name: CoreServiceName): StartupTaskOptions {
  return {
    label: `service.${name}.load`,
    owner: 'service',
    reason:
      'load a core service implementation after an explicit service API demand',
    stage: 'onDemand',
    priority: CORE_SERVICE_LOAD_PRIORITIES[name] || 'normal',
    budgetMs: 240,
  };
}

function loadCoreService(name: CoreServiceName) {
  const pending = serviceLoadPromises.get(name);
  if (pending) {
    return pending;
  }

  const loadPromise = Promise.resolve(
    runOnDemandStartupTask(
      () =>
        import('@/core/services/featureLoaders').then(module =>
          module.loadFeatureCoreService(name),
        ),
      getLoaderTaskOptions(name),
    ),
  )
    .then(() => undefined)
    .catch(error => {
      serviceLoadPromises.delete(name);
      throw error;
    });

  serviceLoadPromises.set(name, loadPromise);
  return loadPromise;
}

export function registerCoreServiceLoaderCatalog() {
  if (catalogRegistered) {
    return;
  }
  catalogRegistered = true;

  (Object.keys(CORE_SERVICE_LOADER_NAMES) as CoreServiceName[]).forEach(
    name => {
      registerCoreServiceLoader(name, () => loadCoreService(name));
    },
  );
}
