describe('store/_resourceFlow', () => {
  const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('@/core/utils/reexports', () => {
      const { create } = require('zustand');
      return {
        zCreate: create,
      };
    });
  });

  it('ignores stale remote results when a newer request is active', () => {
    const {
      ObservableResourceStore,
    }: typeof import('./_resourceFlow') = require('./_resourceFlow');

    const store = new ObservableResourceStore<number>('test-resource');
    const firstRequestId = store.startRemoteFetch('foo');
    const secondRequestId = store.startRemoteFetch('foo');

    expect(store.applyRemoteValue('foo', firstRequestId, 1)).toBe(false);
    expect(store.applyRemoteValue('foo', secondRequestId, 2)).toBe(true);
    expect(store.getValue('foo')).toBe(2);
    expect(store.getMeta('foo')).toMatchObject({
      sourceOfCurrentValue: 'remote',
      isFetchingRemote: false,
      version: 1,
    });
  });

  it('marks persist lifecycle in background without blocking memory writes', async () => {
    const {
      ObservableResourceStore,
    }: typeof import('./_resourceFlow') = require('./_resourceFlow');

    const store = new ObservableResourceStore<number>('test-resource');

    store.applyHydratedValue('foo', 12);
    const persistOrder: string[] = [];
    store.persistInBackground('foo', () => {
      persistOrder.push(`persist:${store.getValue('foo')}`);
    });

    expect(store.getValue('foo')).toBe(12);
    expect(store.getMeta('foo')).toMatchObject({
      persistStatus: 'queued',
      sourceOfCurrentValue: 'hydrate',
    });

    await flushMicrotasks();

    expect(persistOrder).toEqual(['persist:12']);
    expect(store.getMeta('foo')).toMatchObject({
      persistStatus: 'success',
      lastPersistAt: expect.any(Number),
    });
  });
});
