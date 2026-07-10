import type * as SharedServices from './shared';
import {
  callDeferredService,
  ensureDeferredService,
  getRegisteredDeferredService,
  isDeferredServiceRegistered,
  registerDeferredService,
  registerDeferredServiceLoader,
  waitDeferredService,
} from './deferred';
import type { MethodArgs, MethodReturn, ServiceMethod } from './deferred';

type SharedServiceExports = typeof SharedServices;

export type CoreServiceRegistry = Pick<
  SharedServiceExports,
  | 'autoConnectService'
  | 'bridgeService'
  | 'browserHistoryService'
  | 'browserService'
  | 'contactService'
  | 'customRPCService'
  | 'customTestnetService'
  | 'currencyService'
  | 'dappService'
  | 'gasAccountService'
  | 'hdKeyringService'
  | 'keyringService'
  | 'lendingService'
  | 'metamaskModeService'
  | 'notificationService'
  | 'offlineChainService'
  | 'perpsService'
  | 'preferenceService'
  | 'rabbyPointsService'
  | 'securityEngineService'
  | 'sessionService'
  | 'swapService'
  | 'syncChainService'
  | 'transactionBroadcastWatcherService'
  | 'transactionHistoryService'
  | 'transactionWatcherService'
  | 'whitelistService'
>;

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
