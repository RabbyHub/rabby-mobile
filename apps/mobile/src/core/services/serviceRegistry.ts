import type * as SharedServices from './shared';

type SharedServiceExports = typeof SharedServices;

export type CoreServiceRegistry = Pick<
  SharedServiceExports,
  | 'autoConnectService'
  | 'bridgeService'
  | 'browserHistoryService'
  | 'browserService'
  | 'contactService'
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

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const registeredServices = new Map<string, unknown>();
const pendingServices = new Map<string, Deferred<unknown>>();

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(innerResolve => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

export function registerService<T>(name: string, service: T) {
  const previous = registeredServices.get(name);
  if (previous && previous !== service && __DEV__) {
    console.warn(`[serviceRegistry] overriding registered service: ${name}`);
  }

  registeredServices.set(name, service);

  const pending = pendingServices.get(name);
  if (pending) {
    pending.resolve(service);
    pendingServices.delete(name);
  }
}

export function registerCoreServices(services: Partial<CoreServiceRegistry>) {
  Object.entries(services).forEach(([name, service]) => {
    if (service) {
      registerService(name, service);
    }
  });
}

export function getRegisteredService<Name extends CoreServiceName>(
  name: Name,
): CoreServiceRegistry[Name] | undefined {
  return registeredServices.get(name) as CoreServiceRegistry[Name] | undefined;
}

export function waitForCoreService<Name extends CoreServiceName>(
  name: Name,
): Promise<CoreServiceRegistry[Name]> {
  const service = getRegisteredService(name);
  if (service) {
    return Promise.resolve(service);
  }

  const pending = pendingServices.get(name);
  if (pending) {
    return pending.promise as Promise<CoreServiceRegistry[Name]>;
  }

  const nextPending = createDeferred<CoreServiceRegistry[Name]>();
  pendingServices.set(name, nextPending as Deferred<unknown>);
  return nextPending.promise;
}

export async function callCoreService<Name extends CoreServiceName, Ret>(
  name: Name,
  caller: (service: CoreServiceRegistry[Name]) => Ret | Promise<Ret>,
): Promise<Awaited<Ret>> {
  const service = await waitForCoreService(name);
  return caller(service) as Promise<Awaited<Ret>>;
}
