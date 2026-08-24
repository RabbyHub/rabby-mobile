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

  it('publishes batched remote lifecycle changes once per phase', () => {
    const {
      ObservableResourceStore,
    }: typeof import('./_resourceFlow') = require('./_resourceFlow');

    const store = new ObservableResourceStore<number>('test-resource');
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    const requests = store.startRemoteFetchBatch([
      { resourceKey: 'foo' },
      { resourceKey: 'bar' },
      { resourceKey: 'baz' },
    ]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(3);
    expect(requests.map(request => store.getMeta(request.resourceKey))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isFetchingRemote: true }),
        expect.objectContaining({ isFetchingRemote: true }),
        expect.objectContaining({ isFetchingRemote: true }),
      ]),
    );

    const applied = store.applyRemoteValueBatch(
      requests.map((request, index) => ({
        ...request,
        value: index + 1,
      })),
    );

    expect(applied).toEqual([true, true, true]);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getValueMap()).toEqual({
      foo: 1,
      bar: 2,
      baz: 3,
    });
    unsubscribe();
  });

  it('rejects stale entries independently within a remote value batch', () => {
    const {
      ObservableResourceStore,
    }: typeof import('./_resourceFlow') = require('./_resourceFlow');

    const store = new ObservableResourceStore<number>('test-resource');
    const [fooRequest, barRequest] = store.startRemoteFetchBatch([
      { resourceKey: 'foo' },
      { resourceKey: 'bar' },
    ]);
    const newerFooRequest = store.startRemoteFetch('foo');

    expect(
      store.applyRemoteValueBatch([
        { ...fooRequest, value: 1 },
        { ...barRequest, value: 2 },
      ]),
    ).toEqual([false, true]);
    expect(store.getValue('foo')).toBeUndefined();
    expect(store.getValue('bar')).toBe(2);
    expect(store.getMeta('foo')).toMatchObject({
      activeRemoteRequestId: newerFooRequest,
      isFetchingRemote: true,
      version: 0,
    });
    expect(store.getMeta('bar')).toMatchObject({
      activeRemoteRequestId: undefined,
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
