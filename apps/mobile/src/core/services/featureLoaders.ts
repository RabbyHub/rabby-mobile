import { appStorage } from '../storage/mmkv';
import { traceAndroidInstant } from '../utils/androidTrace';
import { keyringService } from './bootstrap';
import {
  isCoreServiceRegistered,
  registerService,
  type CoreServiceName,
} from './serviceRegistry';

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
    registerService(
      'perpsService',
      new PerpsService({
        storageAdapter: appStorage,
        keyringCrypto: {
          decryptWithPassword: value => keyringService.decryptWithPassword(value),
          encryptWithPassword: value => keyringService.encryptWithPassword(value),
          isUnlocked: () => keyringService.isUnlocked(),
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

export function loadFeatureCoreService(name: CoreServiceName) {
  switch (name) {
    case 'bridgeService':
      return loadBridgeService();
    case 'browserHistoryService':
      return loadBrowserHistoryService();
    case 'browserService':
      return loadBrowserService();
    case 'currencyService':
      return loadCurrencyService();
    case 'lendingService':
      return loadLendingService();
    case 'metamaskModeService':
      return loadMetamaskModeService();
    case 'offlineChainService':
      return loadOfflineChainService();
    case 'perpsService':
      return loadPerpsService();
    case 'swapService':
      return loadSwapService();
    case 'syncChainService':
      return loadSyncChainService();
    default:
      return null;
  }
}
