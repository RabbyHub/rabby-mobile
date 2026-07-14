import type { ContactBookService } from '@rabby-wallet/service-address';
import type { KeyringService } from '@rabby-wallet/service-keyring';
import type { PreferenceService } from '../startupServices/preference';
import type { AutoConnectService } from './autoConnect';
import type { BridgeService } from './bridge';
import type { BrowserHistoryService } from './browserHistoryService';
import type { BrowserService } from './browserService';
import type { CurrencyService } from './currencyService';
import type { CustomRPCService } from './customRPCService';
import type { CustomTestnetService } from './customTestnetService';
import type { DappService } from './dappService';
import type { GasAccountService } from './gasAccount';
import type { HDKeyringService } from './hdKeyringService';
import type { LendingService } from './lendingService';
import type { MetamaskModeService } from './metamaskModeService';
import type { NotificationService } from './notification';
import type { OfflineChainService } from './offlineChain';
import type { PerpsService } from './perpsService';
import type { RabbyPointsService } from './rabbyPoints';
import type { SecurityEngineService } from './securityEngine';
import type { SessionService } from './session';
import type { SwapService } from './swap';
import type { SyncChainService } from './syncChainService';
import type { TransactionBroadcastWatcherService } from './transactionBroadcastWatcher';
import type { TransactionHistoryService } from './transactionHistory';
import type { TransactionWatcherService } from './transactionWatcher';
import type { WhitelistService } from './whitelist';
import {
  callDeferredService,
  ensureDeferredService,
  getRegisteredDeferredService,
  isDeferredServiceRegistered,
  registerDeferredService,
  registerDeferredServiceLoader,
  waitDeferredService,
  waitDeferredServiceRegistration,
} from './deferred';
import type { MethodArgs, MethodReturn, ServiceMethod } from './deferred';

export type CoreServiceRegistry = {
  autoConnectService: AutoConnectService;
  bridgeService: BridgeService;
  browserHistoryService: BrowserHistoryService;
  browserService: BrowserService;
  contactService: ContactBookService;
  customRPCService: CustomRPCService;
  customTestnetService: CustomTestnetService;
  currencyService: CurrencyService;
  dappService: DappService;
  gasAccountService: GasAccountService;
  hdKeyringService: HDKeyringService;
  keyringService: KeyringService;
  lendingService: LendingService;
  metamaskModeService: MetamaskModeService;
  notificationService: NotificationService;
  offlineChainService: OfflineChainService;
  perpsService: PerpsService;
  preferenceService: PreferenceService;
  rabbyPointsService: RabbyPointsService;
  securityEngineService: SecurityEngineService;
  sessionService: SessionService;
  swapService: SwapService;
  syncChainService: SyncChainService;
  transactionBroadcastWatcherService: TransactionBroadcastWatcherService;
  transactionHistoryService: TransactionHistoryService;
  transactionWatcherService: TransactionWatcherService;
  whitelistService: WhitelistService;
};

export type CoreServiceName = keyof CoreServiceRegistry;

export function registerService<Name extends CoreServiceName>(
  name: Name,
  service: CoreServiceRegistry[Name],
) {
  const previous = getRegisteredService(name);
  if (previous && previous !== service && __DEV__) {
    console.warn(`[serviceRegistry] overriding registered service: ${name}`);
  }

  return registerDeferredService(name, service);
}

export function registerCoreServices(services: Partial<CoreServiceRegistry>) {
  Object.entries(services).forEach(([name, service]) => {
    if (service) {
      registerService(
        name as CoreServiceName,
        service as CoreServiceRegistry[CoreServiceName],
      );
    }
  });
}

export function registerCoreServiceLoader<Name extends CoreServiceName>(
  name: Name,
  loader: () => void | Promise<void>,
) {
  return registerDeferredServiceLoader(name, loader);
}

export function ensureCoreService<Name extends CoreServiceName>(name: Name) {
  return ensureDeferredService(name);
}

export function isCoreServiceRegistered<Name extends CoreServiceName>(
  name: Name,
) {
  return isDeferredServiceRegistered(name);
}

export function getRegisteredService<Name extends CoreServiceName>(
  name: Name,
): CoreServiceRegistry[Name] | undefined {
  return getRegisteredDeferredService<CoreServiceRegistry[Name]>(name);
}

export function waitForCoreService<Name extends CoreServiceName>(
  name: Name,
  options?: { timeoutMs?: number },
): Promise<CoreServiceRegistry[Name]> {
  return waitDeferredService<CoreServiceRegistry[Name]>(name, options);
}

export function waitForCoreServiceRegistration<Name extends CoreServiceName>(
  name: Name,
  options?: { timeoutMs?: number },
): Promise<CoreServiceRegistry[Name]> {
  return waitDeferredServiceRegistration<CoreServiceRegistry[Name]>(
    name,
    options,
  );
}

export async function callCoreService<Name extends CoreServiceName, Ret>(
  name: Name,
  caller: (service: CoreServiceRegistry[Name]) => Ret | Promise<Ret>,
  options?: { timeoutMs?: number },
): Promise<Awaited<Ret>> {
  const service = await waitForCoreService(name, options);
  return caller(service) as Promise<Awaited<Ret>>;
}

export function callCoreServiceMethod<
  Name extends CoreServiceName,
  TMethod extends ServiceMethod<CoreServiceRegistry[Name]>,
>(
  name: Name,
  method: TMethod,
  args: MethodArgs<CoreServiceRegistry[Name], TMethod>,
  options?: { timeoutMs?: number },
): Promise<MethodReturn<CoreServiceRegistry[Name], TMethod>> {
  return callDeferredService<CoreServiceRegistry[Name], TMethod>(
    name,
    method,
    args,
    options,
  );
}
