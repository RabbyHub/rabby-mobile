import {
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
});
