import {
  beginServiceContractCall,
  finishServiceContractCall,
  recordServiceLifecycleEvent,
} from '@/core/serviceApi/serviceRuntimeDiagnostics';
import type { CoreServiceName } from './serviceRegistry';

export type ServiceMethod<TService> = {
  [TKey in keyof TService]: TService[TKey] extends (...args: any[]) => any
    ? TKey
    : never;
}[keyof TService] &
  string;

export type MethodArgs<
  TService,
  TMethod extends ServiceMethod<TService>,
> = TService[TMethod] extends (...args: infer TArgs) => any ? TArgs : never;

export type MethodReturn<
  TService,
  TMethod extends ServiceMethod<TService>,
> = TService[TMethod] extends (...args: any[]) => infer TReturn
  ? Awaited<TReturn>
  : never;

type Waiter<TService> = {
  resolve: (service: TService) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
};

type DeferredServiceLoader = () => void | Promise<void>;

const serviceMap = new Map<string, unknown>();
const waiterMap = new Map<string, Waiter<any>[]>();
const serviceLoaderMap = new Map<string, DeferredServiceLoader>();
const serviceLoaderPromiseMap = new Map<string, Promise<void>>();
const serviceLoaderErrorMap = new Map<string, Error>();

function rejectWaiters(name: string, error: Error) {
  const waiters = waiterMap.get(name);
  if (!waiters?.length) {
    return;
  }

  waiterMap.delete(name);
  waiters.forEach(waiter => {
    if (waiter.timeoutId) {
      clearTimeout(waiter.timeoutId);
    }
    waiter.reject(error);
  });
}

export function registerDeferredService<TService extends object>(
  name: string,
  service: TService,
) {
  serviceMap.set(name, service);
  serviceLoaderErrorMap.delete(name);
  recordServiceLifecycleEvent(name, 'registered');
  if (!serviceLoaderPromiseMap.has(name)) {
    recordServiceLifecycleEvent(name, 'ready', {
      reason: 'registered_without_active_loader',
    });
  }

  const waiters = waiterMap.get(name);
  if (waiters?.length) {
    waiterMap.delete(name);
    waiters.forEach(waiter => {
      if (waiter.timeoutId) {
        clearTimeout(waiter.timeoutId);
      }
      waiter.resolve(service);
    });
  }

  return () => {
    if (serviceMap.get(name) === service) {
      serviceMap.delete(name);
    }
  };
}

export function registerDeferredServiceLoader(
  name: string,
  loader: DeferredServiceLoader,
) {
  serviceLoaderMap.set(name, loader);
  serviceLoaderErrorMap.delete(name);
  recordServiceLifecycleEvent(name, 'loader-registered');

  return () => {
    if (serviceLoaderMap.get(name) === loader) {
      serviceLoaderMap.delete(name);
      serviceLoaderPromiseMap.delete(name);
      serviceLoaderErrorMap.delete(name);
    }
  };
}

export function ensureDeferredService(name: string) {
  const pendingLoader = serviceLoaderPromiseMap.get(name);
  if (pendingLoader) {
    return pendingLoader;
  }

  const loaderError = serviceLoaderErrorMap.get(name);
  if (loaderError) {
    serviceLoaderErrorMap.delete(name);
  } else if (serviceMap.has(name)) {
    return Promise.resolve();
  }

  const loader = serviceLoaderMap.get(name);
  if (!loader) {
    const error = new Error(
      `Deferred service "${name}" has no registered loader`,
    );
    recordServiceLifecycleEvent(name, 'rejected', {
      reason: 'missing_loader',
      error,
    });
    rejectWaiters(name, error);
    return Promise.reject(error);
  }

  serviceLoaderErrorMap.delete(name);
  const startedAt = Date.now();
  recordServiceLifecycleEvent(name, 'requested', {
    reason: 'first_demand',
  });
  recordServiceLifecycleEvent(name, 'loading', {
    reason: 'loader_started',
  });
  const loaderPromise = Promise.resolve()
    .then(loader)
    .then(() => {
      if (!serviceMap.has(name)) {
        throw new Error(
          `Deferred service "${name}" loader completed without registering a service`,
        );
      }
    })
    .then(() => {
      serviceLoaderPromiseMap.delete(name);
      serviceLoaderErrorMap.delete(name);
      recordServiceLifecycleEvent(name, 'ready', {
        reason: 'loader_completed',
        durationMs: Date.now() - startedAt,
      });
    })
    .catch(error => {
      serviceLoaderPromiseMap.delete(name);
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      serviceLoaderErrorMap.set(name, normalizedError);
      recordServiceLifecycleEvent(name, 'rejected', {
        reason: 'loader_failed',
        durationMs: Date.now() - startedAt,
        error: normalizedError,
      });
      if (!serviceMap.has(name)) {
        rejectWaiters(name, normalizedError);
      }
      throw normalizedError;
    });

  serviceLoaderPromiseMap.set(name, loaderPromise);
  return loaderPromise;
}

export function isDeferredServiceRegistered(name: string) {
  return serviceMap.has(name);
}

export function isDeferredServiceLoaded(name: string) {
  return (
    serviceMap.has(name) &&
    !serviceLoaderPromiseMap.has(name) &&
    !serviceLoaderErrorMap.has(name)
  );
}

export function getRegisteredDeferredService<TService extends object>(
  name: string,
) {
  return serviceMap.get(name) as TService | undefined;
}

function waitForLoaderCompletion(
  name: string,
  loaderPromise: Promise<void>,
  options: { timeoutMs?: number } = {},
) {
  if (typeof options.timeoutMs !== 'number') {
    return loaderPromise;
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Deferred service "${name}" timed out`));
    }, options.timeoutMs);

    loaderPromise.then(
      () => {
        clearTimeout(timeoutId);
        resolve();
      },
      error => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export async function waitDeferredService<TService extends object>(
  name: string,
  options: { timeoutMs?: number } = {},
) {
  await waitForLoaderCompletion(name, ensureDeferredService(name), options);

  const service = serviceMap.get(name) as TService | undefined;
  if (!service) {
    throw new Error(
      `Deferred service "${name}" loader completed without registering a service`,
    );
  }

  return service;
}

export function waitDeferredServiceRegistration<TService extends object>(
  name: string,
  options: { timeoutMs?: number } = {},
) {
  const service = serviceMap.get(name) as TService | undefined;
  if (service) {
    return Promise.resolve(service);
  }

  return new Promise<TService>((resolve, reject) => {
    const waiter: Waiter<TService> = { resolve, reject };

    if (typeof options.timeoutMs === 'number') {
      waiter.timeoutId = setTimeout(() => {
        const waiters = waiterMap.get(name);
        if (waiters) {
          waiterMap.set(
            name,
            waiters.filter(item => item !== waiter),
          );
        }
        reject(new Error(`Deferred service "${name}" timed out`));
      }, options.timeoutMs);
    }

    const waiters = waiterMap.get(name);
    if (waiters) {
      waiters.push(waiter);
    } else {
      waiterMap.set(name, [waiter]);
    }
  });
}

export async function callDeferredService<
  TService extends object,
  TMethod extends ServiceMethod<TService>,
>(
  name: string,
  method: TMethod,
  args: MethodArgs<TService, TMethod>,
  options?: { timeoutMs?: number },
): Promise<MethodReturn<TService, TMethod>> {
  const serviceName = name as CoreServiceName;
  const callId = beginServiceContractCall(serviceName, method);

  try {
    const service = await waitDeferredService<TService>(name, options);
    const handler = service[method] as (
      ...methodArgs: MethodArgs<TService, TMethod>
    ) =>
      | MethodReturn<TService, TMethod>
      | Promise<MethodReturn<TService, TMethod>>;
    const result = await handler.apply(service, args);
    finishServiceContractCall(callId, 'resolved');
    return result;
  } catch (error) {
    finishServiceContractCall(callId, 'rejected', error);
    throw error;
  }
}
