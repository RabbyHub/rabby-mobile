import {
  callCoreServiceMethod,
  ensureCoreService,
  isCoreServiceRegistered,
  registerCoreServiceLoader,
  waitForCoreService,
} from '@/core/services/serviceRegistry';
import type {
  CoreServiceName,
  CoreServiceRegistry,
} from '@/core/services/serviceRegistry';
import type {
  MethodArgs,
  MethodReturn,
  ServiceMethod,
} from '@/core/services/deferred';

export type DeferredServiceApi<TService extends object> = {
  readonly [TMethod in ServiceMethod<TService>]: (
    ...args: MethodArgs<TService, TMethod>
  ) => Promise<MethodReturn<TService, TMethod>>;
};

let legacyCoreServicesLoadPromise: Promise<void> | null = null;
const featureCoreServiceLoadPromiseMap = new Map<string, Promise<void>>();

function loadLegacyCoreServices() {
  if (legacyCoreServicesLoadPromise) {
    return legacyCoreServicesLoadPromise;
  }

  legacyCoreServicesLoadPromise = import('@/core/services')
    .then(() => undefined)
    .catch(error => {
      legacyCoreServicesLoadPromise = null;
      throw error;
    });

  return legacyCoreServicesLoadPromise;
}

function loadFeatureCoreService(name: CoreServiceName) {
  const pending = featureCoreServiceLoadPromiseMap.get(name);
  if (pending) {
    return pending;
  }

  const loadPromise = import('@/core/services/featureLoaders')
    .then(module => module.loadFeatureCoreService(name))
    .then(result => {
      if (result === null) {
        return loadLegacyCoreServices();
      }
      return undefined;
    })
    .catch(error => {
      featureCoreServiceLoadPromiseMap.delete(name);
      throw error;
    });

  featureCoreServiceLoadPromiseMap.set(name, loadPromise);
  return loadPromise;
}

export function registerLegacyCoreServiceLoader<Name extends CoreServiceName>(
  name: Name,
) {
  return registerCoreServiceLoader(name, () => loadFeatureCoreService(name));
}

export function createDeferredServiceApi<
  Name extends CoreServiceName,
  TContract extends object = CoreServiceRegistry[Name],
>(name: Name): DeferredServiceApi<TContract> {
  const methodCache = new Map<
    string,
    (...args: unknown[]) => Promise<unknown>
  >();

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string' || property === 'then') {
          return undefined;
        }

        const cached = methodCache.get(property);
        if (cached) {
          return cached;
        }

        const handler = (...args: unknown[]) =>
          callCoreServiceMethod(
            name,
            property as ServiceMethod<CoreServiceRegistry[Name]>,
            args as MethodArgs<
              CoreServiceRegistry[Name],
              ServiceMethod<CoreServiceRegistry[Name]>
            >,
          );

        methodCache.set(property, handler);
        return handler;
      },
    },
  ) as DeferredServiceApi<TContract>;
}

export function ensureServiceApiReady<Name extends CoreServiceName>(
  name: Name,
) {
  return ensureCoreService(name);
}

export function isServiceApiReady<Name extends CoreServiceName>(name: Name) {
  return isCoreServiceRegistered(name);
}

export async function waitServiceApiReady<Name extends CoreServiceName>(
  name: Name,
  options?: { timeoutMs?: number },
) {
  await waitForCoreService(name, options);
}
