type AppDataSourceLoader = (reason: string) => void | Promise<void>;

type AppDataSourceRegistration = {
  loader: AppDataSourceLoader;
  owner: string;
};

const appDataSourceRegistryRef: {
  registration: AppDataSourceRegistration | null;
  loaderPromise: Promise<void> | null;
} = {
  registration: null,
  loaderPromise: null,
};

export function registerAppDataSourceLoader(
  loader: AppDataSourceLoader,
  options: {
    owner: string;
  },
) {
  const previous = appDataSourceRegistryRef.registration;
  if (previous?.loader && previous.loader !== loader && __DEV__) {
    console.warn(
      `[databases/registry] overriding app data source loader: ${previous.owner} -> ${options.owner}`,
    );
  }

  appDataSourceRegistryRef.registration = {
    loader,
    owner: options.owner,
  };
}

export function resetAppDataSourceLoaderState() {
  appDataSourceRegistryRef.loaderPromise = null;
}

export function getAppDataSourceRegistrySnapshot() {
  return {
    registered: !!appDataSourceRegistryRef.registration,
    owner: appDataSourceRegistryRef.registration?.owner || null,
    loading: !!appDataSourceRegistryRef.loaderPromise,
  };
}

export function ensureAppDataSourceLoaderStarted(
  reason = 'unknown',
): Promise<void> {
  if (appDataSourceRegistryRef.loaderPromise) {
    return appDataSourceRegistryRef.loaderPromise;
  }

  const registration = appDataSourceRegistryRef.registration;
  if (!registration) {
    return Promise.reject(
      new Error('[databases/registry] app data source loader is not registered'),
    );
  }

  const loaderPromise = Promise.resolve()
    .then(() => registration.loader(reason))
    .catch(error => {
      appDataSourceRegistryRef.loaderPromise = null;
      throw error;
    });

  appDataSourceRegistryRef.loaderPromise = loaderPromise;
  return loaderPromise;
}
