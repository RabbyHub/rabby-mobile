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

  return () => {
    if (serviceLoaderMap.get(name) === loader) {
      serviceLoaderMap.delete(name);
      serviceLoaderPromiseMap.delete(name);
    }
  };
}

export function ensureDeferredService(name: string) {
  if (serviceMap.has(name)) {
    return Promise.resolve();
  }

  const loader = serviceLoaderMap.get(name);
  if (!loader) {
    return Promise.resolve();
  }

  const pendingLoader = serviceLoaderPromiseMap.get(name);
  if (pendingLoader) {
    return pendingLoader;
  }

  const loaderPromise = Promise.resolve()
    .then(loader)
    .catch(error => {
      serviceLoaderPromiseMap.delete(name);
      if (!serviceMap.has(name)) {
        rejectWaiters(
          name,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      throw error;
    });

  serviceLoaderPromiseMap.set(name, loaderPromise);
  return loaderPromise;
}

export function isDeferredServiceRegistered(name: string) {
  return serviceMap.has(name);
}

export function getRegisteredDeferredService<TService extends object>(
  name: string,
) {
  return serviceMap.get(name) as TService | undefined;
}

export function waitDeferredService<TService extends object>(
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

    ensureDeferredService(name).catch(() => {
      // Waiters are rejected inside ensureDeferredService.
    });
  });
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
  const service = await waitDeferredService<TService>(name, options);
  const handler = service[method] as (
    ...methodArgs: MethodArgs<TService, TMethod>
  ) =>
    | MethodReturn<TService, TMethod>
    | Promise<MethodReturn<TService, TMethod>>;

  return handler.apply(service, args);
}
