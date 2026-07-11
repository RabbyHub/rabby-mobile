import { appStorage } from '../storage/mmkv';

import { BridgeService } from './bridge';
import { BrowserHistoryService } from './browserHistoryService';
import { BrowserService } from './browserService';
import { CurrencyService } from './currencyService';
import { LendingService } from './lendingService';
import { MetamaskModeService } from './metamaskModeService';
import { OfflineChainService } from './offlineChain';
import { PerpsService } from './perpsService';
import type { AutoConnectService } from './autoConnect';
import type { RabbyPointsService } from './rabbyPoints';
import { SwapService } from './swap';
import { SyncChainService } from './syncChainService';
import { registerCoreServices } from './serviceRegistry';
import { keyringService } from './bootstrap';
import type { CustomRPCService } from './customRPCService';
import type { CustomTestnetService } from './customTestnetService';

export * from './bootstrap';
export { default as debugLogService } from '../utils/debugLogService';

export declare const autoConnectService: AutoConnectService;
export declare const customRPCService: CustomRPCService;
export declare const customTestnetService: CustomTestnetService;
export declare const rabbyPointsService: RabbyPointsService;

export const browserHistoryService = new BrowserHistoryService({
  storageAdapter: appStorage,
});

export const swapService = new SwapService({
  storageAdapter: appStorage,
});

export const bridgeService = new BridgeService({
  storageAdapter: appStorage,
});

export const offlineChainService = new OfflineChainService({
  storageAdapter: appStorage,
});

export const browserService = new BrowserService({
  storageAdapter: appStorage,
});

export const metamaskModeService = new MetamaskModeService({
  storageAdapter: appStorage,
});

export const syncChainService = new SyncChainService({
  storageAdapter: appStorage,
});

export const perpsService = new PerpsService({
  storageAdapter: appStorage,
  keyringCrypto: {
    decryptWithPassword: value => keyringService.decryptWithPassword(value),
    encryptWithPassword: value => keyringService.encryptWithPassword(value),
    isUnlocked: () => keyringService.isUnlocked(),
  },
});

export const lendingService = new LendingService({
  storageAdapter: appStorage,
});

export const currencyService = new CurrencyService({
  storageAdapter: appStorage,
});

registerCoreServices({
  bridgeService,
  browserHistoryService,
  browserService,
  currencyService,
  lendingService,
  metamaskModeService,
  offlineChainService,
  perpsService,
  swapService,
  syncChainService,
});
