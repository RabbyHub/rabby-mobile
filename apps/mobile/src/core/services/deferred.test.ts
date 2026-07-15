import {
  ensureDeferredService,
  isDeferredServiceLoaded,
  registerDeferredService,
  registerDeferredServiceLoader,
  waitDeferredService,
} from './deferred';

describe('deferred service loading', () => {
  it('fails fast when a requested service has no loader', async () => {
    await expect(waitDeferredService('missing-loader-service')).rejects.toThrow(
      'has no registered loader',
    );
  });

  it('supports calling before the service instance is registered', async () => {
    const name = 'late-registered-service';
    const service = { value: 42 };
    const disposeLoader = registerDeferredServiceLoader(name, async () => {
      await Promise.resolve();
      registerDeferredService(name, service);
    });

    await expect(waitDeferredService<typeof service>(name)).resolves.toBe(
      service,
    );
    disposeLoader();
  });

  it('rejects pending callers when a loader completes without registration', async () => {
    const name = 'loader-without-registration';
    const disposeLoader = registerDeferredServiceLoader(name, async () => {});

    await expect(waitDeferredService(name)).rejects.toThrow(
      'loader completed without registering a service',
    );

    disposeLoader();
  });

  it('allows a failed no-registration loader to retry', async () => {
    const name = 'retry-after-missing-registration';
    const service = { value: 7 };
    let shouldRegister = false;
    const disposeLoader = registerDeferredServiceLoader(name, async () => {
      if (shouldRegister) {
        registerDeferredService(name, service);
      }
    });

    await expect(ensureDeferredService(name)).rejects.toThrow(
      'loader completed without registering a service',
    );

    shouldRegister = true;
    await expect(ensureDeferredService(name)).resolves.toBeUndefined();
    await expect(waitDeferredService<typeof service>(name)).resolves.toBe(
      service,
    );

    disposeLoader();
  });

  it('waits for a running loader to finish even after it registers early', async () => {
    const name = 'early-registration-loader';
    const service = { value: 99 };
    let releaseLoader: (() => void) | undefined;
    let markRegistered: (() => void) | undefined;
    const registered = new Promise<void>(resolve => {
      markRegistered = resolve;
    });
    const loaderFinished = new Promise<void>(resolve => {
      releaseLoader = resolve;
    });
    const disposeLoader = registerDeferredServiceLoader(name, async () => {
      registerDeferredService(name, service);
      markRegistered?.();
      await loaderFinished;
    });

    const registrationPromise = waitDeferredService<typeof service>(name);
    const ensurePromise = ensureDeferredService(name);

    await registered;
    await expect(registrationPromise).resolves.toBe(service);
    expect(isDeferredServiceLoaded(name)).toBe(false);

    let ensureSettled = false;
    void ensurePromise.then(() => {
      ensureSettled = true;
    });
    await Promise.resolve();
    expect(ensureSettled).toBe(false);

    releaseLoader?.();
    await expect(ensurePromise).resolves.toBeUndefined();
    expect(ensureSettled).toBe(true);
    expect(isDeferredServiceLoaded(name)).toBe(true);

    disposeLoader();
  });

  it('does not report an early-registered service as loaded when its loader fails', async () => {
    const name = 'early-registration-failed-loader';
    const service = { value: 101 };
    const disposeLoader = registerDeferredServiceLoader(name, async () => {
      registerDeferredService(name, service);
      throw new Error('loader failed after registration');
    });

    await expect(ensureDeferredService(name)).rejects.toThrow(
      'loader failed after registration',
    );
    expect(isDeferredServiceLoaded(name)).toBe(false);

    disposeLoader();
  });
});
