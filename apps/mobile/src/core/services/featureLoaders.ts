import { appStorage } from '../storage/mmkv';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { migrateService } from '@/migrations/migrations';
import { traceAndroidInstant } from '../utils/androidTrace';
import {
  getRegisteredService,
  isCoreServiceLoaded,
  registerService,
  requireCoreService,
  type CoreServiceName,
  type CoreServiceRegistry,
} from './serviceRegistry';
import { observeStartupModuleLoad } from '@/startup/runtimeDiagnostics';

let startupCoreServicesPromise: Promise<void> | null = null;

function traceFeatureServiceLoad(
  name: CoreServiceName,
  event: 'start' | 'done' | 'skip',
  extra?: Record<string, unknown>,
) {
  traceAndroidInstant(`service_loader.${name}.${event}`, extra);
}

async function loadFeatureService<Name extends CoreServiceName>(
  name: Name,
  loader: () => Promise<void>,
) {
  if (isCoreServiceLoaded(name)) {
    traceFeatureServiceLoad(name, 'skip');
    return;
  }

  const startedAt = Date.now();
  traceFeatureServiceLoad(name, 'start');
  await observeStartupModuleLoad(
    {
      name: `core-service/${name}`,
      group: 'service',
      taskStage: 'onDemand',
      reason: 'core service implementation and initialization',
    },
    loader,
  );
  traceFeatureServiceLoad(name, 'done', {
    durationMs: Date.now() - startedAt,
  });
}

function loadStartupCoreService(name: CoreServiceName) {
  return loadFeatureService(name, async () => {
    if (!startupCoreServicesPromise) {
      startupCoreServicesPromise = import('./startupCoreLoader').then(module =>
        module.loadStartupCoreServices(),
      );
      startupCoreServicesPromise.catch(() => {
        startupCoreServicesPromise = null;
      });
    }
    await startupCoreServicesPromise;
  });
}

export function loadTransactionHistoryService() {
  return loadFeatureService('transactionHistoryService', async () => {
    const { TransactionHistoryService } = await import('./transactionHistory');
    const preferenceService = requireCoreService('preferenceService');
    registerService(
      'transactionHistoryService',
      new TransactionHistoryService({
        storageAdapter: appStorage,
        preferenceService,
      }),
    );
  });
}

async function restorePendingTransactions(
  transactionHistoryService: CoreServiceRegistry['transactionHistoryService'],
  transactionWatcherService: CoreServiceRegistry['transactionWatcherService'],
) {
  const { findChainByID } = await import('@/utils/chain');

  transactionHistoryService
    .getTransactionGroups()
    .filter(item => item.isPending)
    .forEach(item => {
      const chain = findChainByID(item.chainId);
      if (!chain || !item.maxGasTx.hash) {
        return;
      }

      const key = `${item.address}_${item.nonce}_${chain.enum}`;
      if (transactionWatcherService.hasTx(key)) {
        return;
      }

      transactionWatcherService.addTx(key, {
        nonce: String(item.nonce),
        hash: item.maxGasTx.hash,
        chain: chain.enum,
      });
    });
}

function getTransactionHistoryServiceDependency() {
  return requireCoreService('transactionHistoryService');
}

function getTransactionWatcherServiceDependency() {
  return requireCoreService('transactionWatcherService');
}

export function loadTransactionWatcherService() {
  return loadFeatureService('transactionWatcherService', async () => {
    const { TransactionWatcherService } = await import('./transactionWatcher');
    const transactionHistoryService = getTransactionHistoryServiceDependency();
    const transactionWatcherService = new TransactionWatcherService({
      storageAdapter: appStorage,
      transactionHistoryService,
    });
    registerService('transactionWatcherService', transactionWatcherService);
    transactionWatcherService.start();
    await restorePendingTransactions(
      transactionHistoryService,
      transactionWatcherService,
    );
  });
}

export function loadTransactionBroadcastWatcherService() {
  return loadFeatureService('transactionBroadcastWatcherService', async () => {
    const { TransactionBroadcastWatcherService } = await import(
      './transactionBroadcastWatcher'
    );
    const transactionHistoryService = getTransactionHistoryServiceDependency();
    const transactionWatcherService = getTransactionWatcherServiceDependency();
    const transactionBroadcastWatcherService =
      new TransactionBroadcastWatcherService({
        storageAdapter: appStorage,
        transactionHistoryService,
        transactionWatcherService,
      });
    registerService(
      'transactionBroadcastWatcherService',
      transactionBroadcastWatcherService,
    );
    transactionBroadcastWatcherService.start();
  });
}

export function loadSecurityEngineService() {
  return loadFeatureService('securityEngineService', async () => {
    const { SecurityEngineService } = await import('./securityEngine');
    const securityEngineService = new SecurityEngineService({
      storageAdapter: appStorage,
    });
    await securityEngineService.init();
    registerService('securityEngineService', securityEngineService);
  });
}

export function loadBridgeService() {
  return loadFeatureService('bridgeService', async () => {
    const { BridgeService } = await import('./bridge');
    registerService(
      'bridgeService',
      new BridgeService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadBrowserService() {
  return loadFeatureService('browserService', async () => {
    const { BrowserService } = await import('./browserService');
    registerService(
      'browserService',
      new BrowserService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadCurrencyService() {
  return loadFeatureService('currencyService', async () => {
    const { CurrencyService } = await import('./currencyService');
    registerService(
      'currencyService',
      new CurrencyService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadCustomRPCService() {
  return loadFeatureService('customRPCService', async () => {
    const { CustomRPCService } = await import('./customRPCService');
    registerService(
      'customRPCService',
      new CustomRPCService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadCustomTestnetService() {
  return loadFeatureService('customTestnetService', async () => {
    const { CustomTestnetService } = await import('./customTestnetService');
    registerService(
      'customTestnetService',
      new CustomTestnetService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadLendingService() {
  return loadFeatureService('lendingService', async () => {
    const { LendingService } = await import('./lendingService');
    registerService(
      'lendingService',
      new LendingService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadMetamaskModeService() {
  return loadFeatureService('metamaskModeService', async () => {
    const { MetamaskModeService } = await import('./metamaskModeService');
    registerService(
      'metamaskModeService',
      new MetamaskModeService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadOfflineChainService() {
  return loadFeatureService('offlineChainService', async () => {
    const { OfflineChainService } = await import('./offlineChain');
    registerService(
      'offlineChainService',
      new OfflineChainService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadPerpsService() {
  return loadFeatureService('perpsService', async () => {
    const { PerpsService } = await import('./perpsService');
    const getKeyringService = () => {
      const service = getRegisteredService('keyringService');
      if (!service) {
        throw new Error('keyringService is not ready');
      }
      return service;
    };

    registerService(
      'perpsService',
      new PerpsService({
        storageAdapter: appStorage,
        keyringCrypto: {
          decryptWithPassword: value =>
            getKeyringService().decryptWithPassword(value),
          encryptWithPassword: value =>
            getKeyringService().encryptWithPassword(value),
          isUnlocked: () => getKeyringService().isUnlocked(),
        },
      }),
    );
  });
}

export function loadSwapService() {
  return loadFeatureService('swapService', async () => {
    const { SwapService } = await import('./swap');
    registerService(
      'swapService',
      new SwapService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadSyncChainService() {
  return loadFeatureService('syncChainService', async () => {
    const { SyncChainService } = await import('./syncChainService');
    registerService(
      'syncChainService',
      new SyncChainService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadBrowserHistoryService() {
  return loadFeatureService('browserHistoryService', async () => {
    const { BrowserHistoryService } = await import('./browserHistoryService');
    registerService(
      'browserHistoryService',
      new BrowserHistoryService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadDappService() {
  return loadFeatureService('dappService', async () => {
    const { DappService } = await import('./dappService');
    const preferenceService = requireCoreService('preferenceService');
    const dappService = new DappService({
      storageAdapter: appStorage,
    });
    migrateService(APP_STORE_NAMES.dapps, dappService, {
      [APP_STORE_NAMES.preference]: preferenceService,
    });
    registerService('dappService', dappService);
  });
}

export function loadSessionService() {
  return loadFeatureService('sessionService', async () => {
    const { SessionService } = await import('./session');
    const dappService = requireCoreService('dappService');
    registerService(
      'sessionService',
      new SessionService({
        dappService,
      }),
    );
  });
}

export function loadWhitelistService() {
  return loadFeatureService('whitelistService', async () => {
    const { WhitelistService } = await import('./whitelist');
    const whitelistService = new WhitelistService({
      storageAdapter: appStorage,
    });
    migrateService(APP_STORE_NAMES.whitelist, whitelistService);
    registerService('whitelistService', whitelistService);
  });
}

export function loadNotificationService() {
  return loadFeatureService('notificationService', async () => {
    const { NotificationService } = await import('./notification');
    const preferenceService = requireCoreService('preferenceService');
    const transactionHistoryService = getTransactionHistoryServiceDependency();
    registerService(
      'notificationService',
      new NotificationService({
        preferenceService,
        transactionHistoryService,
      }),
    );
  });
}

export function loadHDKeyringService() {
  return loadFeatureService('hdKeyringService', async () => {
    const { HDKeyringService } = await import('./hdKeyringService');
    registerService(
      'hdKeyringService',
      new HDKeyringService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadGasAccountService() {
  return loadFeatureService('gasAccountService', async () => {
    const { GasAccountService } = await import('./gasAccount');
    registerService(
      'gasAccountService',
      new GasAccountService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadAutoConnectService() {
  return loadFeatureService('autoConnectService', async () => {
    const { AutoConnectService } = await import('./autoConnect');
    const dappService = requireCoreService('dappService');
    const keyringService = requireCoreService('keyringService');
    const preferenceService = requireCoreService('preferenceService');
    const transactionHistoryService = getTransactionHistoryServiceDependency();

    registerService(
      'autoConnectService',
      new AutoConnectService({
        dappService,
        getAccounts: () => keyringService.getAllVisibleAccountsArray(),
        getRecentTransactions: () =>
          transactionHistoryService.getStoreFieldSnapshot('transactions'),
        getFallbackAccount: () => preferenceService.getFallbackAccount(),
      }),
    );
  });
}

export function loadRabbyPointsService() {
  return loadFeatureService('rabbyPointsService', async () => {
    const { RabbyPointsService } = await import('./rabbyPoints');
    registerService(
      'rabbyPointsService',
      new RabbyPointsService({
        storageAdapter: appStorage,
      }),
    );
  });
}

export function loadFeatureCoreService(name: CoreServiceName) {
  switch (name) {
    case 'autoConnectService':
      return loadAutoConnectService();
    case 'bridgeService':
      return loadBridgeService();
    case 'browserHistoryService':
      return loadBrowserHistoryService();
    case 'browserService':
      return loadBrowserService();
    case 'contactService':
      return loadStartupCoreService(name);
    case 'currencyService':
      return loadCurrencyService();
    case 'customRPCService':
      return loadCustomRPCService();
    case 'customTestnetService':
      return loadCustomTestnetService();
    case 'dappService':
      return loadDappService();
    case 'gasAccountService':
      return loadGasAccountService();
    case 'hdKeyringService':
      return loadHDKeyringService();
    case 'keyringService':
      return loadStartupCoreService(name);
    case 'lendingService':
      return loadLendingService();
    case 'metamaskModeService':
      return loadMetamaskModeService();
    case 'notificationService':
      return loadNotificationService();
    case 'offlineChainService':
      return loadOfflineChainService();
    case 'perpsService':
      return loadPerpsService();
    case 'preferenceService':
      return loadStartupCoreService(name);
    case 'rabbyPointsService':
      return loadRabbyPointsService();
    case 'securityEngineService':
      return loadSecurityEngineService();
    case 'sessionService':
      return loadSessionService();
    case 'swapService':
      return loadSwapService();
    case 'syncChainService':
      return loadSyncChainService();
    case 'transactionBroadcastWatcherService':
      return loadTransactionBroadcastWatcherService();
    case 'transactionHistoryService':
      return loadTransactionHistoryService();
    case 'transactionWatcherService':
      return loadTransactionWatcherService();
    case 'whitelistService':
      return loadWhitelistService();
    default:
      return null;
  }
}
