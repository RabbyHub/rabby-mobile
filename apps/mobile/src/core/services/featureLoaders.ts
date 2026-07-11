import { appStorage } from '../storage/mmkv';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { migrateService } from '@/migrations/migrations';
import { traceAndroidInstant } from '../utils/androidTrace';
import {
  getRegisteredService,
  isCoreServiceRegistered,
  registerService,
  type CoreServiceName,
  waitForCoreService,
} from './serviceRegistry';

let bootstrapCoreServicesPromise: Promise<void> | null = null;

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
  if (isCoreServiceRegistered(name)) {
    traceFeatureServiceLoad(name, 'skip');
    return;
  }

  const startedAt = Date.now();
  traceFeatureServiceLoad(name, 'start');
  await loader();
  traceFeatureServiceLoad(name, 'done', {
    durationMs: Date.now() - startedAt,
  });
}

function loadBootstrapCoreServices(name: CoreServiceName) {
  return loadFeatureService(name, async () => {
    if (!bootstrapCoreServicesPromise) {
      bootstrapCoreServicesPromise = import('./bootstrap').then(
        () => undefined,
      );
    }
    await bootstrapCoreServicesPromise;
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
    const preferenceService = await waitForCoreService('preferenceService');
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
    const dappService = await waitForCoreService('dappService');
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
    const [preferenceService, transactionHistoryService] = await Promise.all([
      waitForCoreService('preferenceService'),
      waitForCoreService('transactionHistoryService'),
    ]);
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
    const [
      dappService,
      keyringService,
      preferenceService,
      transactionHistoryService,
    ] = await Promise.all([
      waitForCoreService('dappService'),
      waitForCoreService('keyringService'),
      waitForCoreService('preferenceService'),
      waitForCoreService('transactionHistoryService'),
    ]);

    registerService(
      'autoConnectService',
      new AutoConnectService({
        dappService,
        getAccounts: () => keyringService.getAllVisibleAccountsArray(),
        getRecentTransactions: () =>
          transactionHistoryService.store.transactions,
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
      return loadBootstrapCoreServices(name);
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
      return loadBootstrapCoreServices(name);
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
      return loadBootstrapCoreServices(name);
    case 'rabbyPointsService':
      return loadRabbyPointsService();
    case 'securityEngineService':
      return loadBootstrapCoreServices(name);
    case 'sessionService':
      return loadSessionService();
    case 'swapService':
      return loadSwapService();
    case 'syncChainService':
      return loadSyncChainService();
    case 'transactionBroadcastWatcherService':
      return loadBootstrapCoreServices(name);
    case 'transactionHistoryService':
      return loadBootstrapCoreServices(name);
    case 'transactionWatcherService':
      return loadBootstrapCoreServices(name);
    case 'whitelistService':
      return loadWhitelistService();
    default:
      return null;
  }
}
