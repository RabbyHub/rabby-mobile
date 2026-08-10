import type { StorageAdapater, StorageItemTpl } from './storageAdapter';
import createPersistStore from './createPersistStore';

type TestStore = {
  count: number;
  nested: {
    value: string;
    optional?: string;
  };
  items: string[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeSerializingStorage(initial?: Record<string, StorageItemTpl>) {
  const data = new Map<string, StorageItemTpl>();
  Object.entries(initial || {}).forEach(([key, value]) => {
    data.set(key, clone(value));
  });

  const writes: Array<{ key: string; value: StorageItemTpl }> = [];
  let flushCount = 0;
  const storage: StorageAdapater<Record<string, StorageItemTpl>> = {
    getItem(key) {
      const value = data.get(key);
      return value === undefined ? null : clone(value);
    },
    setItem(key, value) {
      const snapshot = clone(value as StorageItemTpl);
      data.set(String(key), snapshot);
      writes.push({ key: String(key), value: snapshot });
    },
    removeItem(key) {
      data.delete(String(key));
    },
    clearAll() {
      data.clear();
    },
    flushToDisk() {
      flushCount += 1;
    },
  };

  return {
    storage,
    writes,
    getFlushCount: () => flushCount,
    getItem: <T>(key: string) => clone(data.get(key) as T),
  };
}

function makeStore(
  storage = makeSerializingStorage(),
  options: { enableDevMutationGuard?: boolean } = {},
) {
  const controller = createPersistStore<TestStore>(
    {
      name: 'testStore',
      template: {
        count: 0,
        nested: { value: 'initial' },
        items: [],
      },
    },
    {
      storage: storage.storage,
      enableDevMutationGuard: options.enableDevMutationGuard,
    },
  );
  return { controller, storage };
}

async function nextMicrotask() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createPersistStore', () => {
  it('hydrates storage over template defaults without sharing storage references', () => {
    const storage = makeSerializingStorage({
      testStore: {
        count: 3,
        nested: { value: 'stored' },
        items: ['stored'],
      },
    });
    const { controller } = makeStore(storage);

    expect(controller.getSnapshot()).toEqual({
      count: 3,
      nested: { value: 'stored' },
      items: ['stored'],
    });
    expect(storage.writes).toHaveLength(0);
  });

  it('persists a newly initialized store immediately', () => {
    const { controller, storage } = makeStore();

    expect(controller.getSnapshot()).toEqual({
      count: 0,
      nested: { value: 'initial' },
      items: [],
    });
    expect(storage.writes).toHaveLength(1);
  });

  it('tracks nested set, add, delete and array mutations as one transaction', async () => {
    const storage = makeSerializingStorage({
      testStore: {
        count: 0,
        nested: { value: 'initial' },
        items: [],
      },
    });
    const { controller } = makeStore(storage);

    controller.update(draft => {
      draft.nested.value = 'updated';
      draft.nested.optional = 'added';
      delete draft.nested.optional;
      draft.items.push('first', 'second');
      draft.items.splice(0, 1);
    });

    expect(controller.getSnapshot()).toEqual({
      count: 0,
      nested: { value: 'updated' },
      items: ['second'],
    });
    expect(storage.writes).toHaveLength(0);

    await nextMicrotask();

    expect(storage.writes).toHaveLength(1);
    expect(storage.getItem<TestStore>('testStore')).toEqual({
      count: 0,
      nested: { value: 'updated' },
      items: ['second'],
    });
  });

  it('coalesces same-turn updates and only persists the latest revision', async () => {
    const storage = makeSerializingStorage({
      testStore: {
        count: 0,
        nested: { value: 'initial' },
        items: [],
      },
    });
    const { controller } = makeStore(storage);

    controller.update(draft => {
      draft.count = 1;
    });
    controller.update(draft => {
      draft.count = 2;
    });
    controller.update(draft => {
      draft.count = 3;
    });

    expect(storage.writes).toHaveLength(0);
    await nextMicrotask();

    expect(storage.writes).toEqual([
      {
        key: 'testStore',
        value: {
          count: 3,
          nested: { value: 'initial' },
          items: [],
        },
      },
    ]);
  });

  it('does not notify or persist a no-op recipe', async () => {
    const storage = makeSerializingStorage({
      testStore: {
        count: 0,
        nested: { value: 'initial' },
        items: [],
      },
    });
    const { controller } = makeStore(storage);
    const listener = jest.fn();
    controller.subscribe(listener);

    controller.update(() => undefined);
    await nextMicrotask();

    expect(listener).not.toHaveBeenCalled();
    expect(storage.writes).toHaveLength(0);
  });

  it('notifies subscribers after commit with paths and final state', () => {
    const storage = makeSerializingStorage({
      testStore: {
        count: 0,
        nested: { value: 'initial' },
        items: [],
      },
    });
    const { controller } = makeStore(storage);
    const listener = jest.fn();
    const fieldListener = jest.fn();
    const dispose = controller.subscribe(listener);
    controller.subscribeField('nested', fieldListener);

    controller.update(draft => {
      draft.count = 1;
      draft.nested.value = 'updated';
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const change = listener.mock.calls[0][0];
    expect(change.revision).toBe(1);
    expect(change.previousState.count).toBe(0);
    expect(change.state.count).toBe(1);
    expect(change.changedKeys).toEqual(
      expect.arrayContaining(['count', 'nested']),
    );
    expect(change.changedKeys).toHaveLength(2);
    expect(change.changedPaths).toEqual(
      expect.arrayContaining([['count'], ['nested', 'value']]),
    );
    expect(fieldListener).toHaveBeenCalledWith(
      { value: 'updated' },
      { value: 'initial' },
      change,
    );

    dispose();
    controller.update(draft => {
      draft.count = 2;
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('flushes the latest state synchronously and invalidates scheduled work', async () => {
    const storage = makeSerializingStorage({
      testStore: {
        count: 0,
        nested: { value: 'initial' },
        items: [],
      },
    });
    const { controller } = makeStore(storage);

    controller.update(draft => {
      draft.count = 7;
    });
    controller.flushNow();

    expect(storage.writes).toHaveLength(1);
    expect(storage.getFlushCount()).toBe(1);
    expect(storage.getItem<TestStore>('testStore').count).toBe(7);

    await nextMicrotask();
    expect(storage.writes).toHaveLength(1);
  });

  it('runs beforePersist once with the final coalesced snapshot', async () => {
    const storage = makeSerializingStorage({
      testStore: {
        count: 0,
        nested: { value: 'initial' },
        items: [],
      },
    });
    const beforePersist = jest.fn();
    const controller = createPersistStore<TestStore>(
      {
        name: 'testStore',
        template: {
          count: 0,
          nested: { value: 'initial' },
          items: [],
        },
      },
      { storage: storage.storage, beforePersist },
    );

    controller.update(draft => {
      draft.count = 1;
    });
    controller.update(draft => {
      draft.count = 2;
    });
    await nextMicrotask();

    expect(beforePersist).toHaveBeenCalledTimes(1);
    expect(beforePersist).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2 }),
    );
  });

  it('throws on direct root, nested, delete and array mutation in dev guard mode', () => {
    const { controller } = makeStore(makeSerializingStorage(), {
      enableDevMutationGuard: true,
    });
    const snapshot = controller.getSnapshot();

    expect(() => {
      // @ts-expect-error runtime guard coverage
      snapshot.count = 1;
    }).toThrow('testStore.count');
    expect(() => {
      // @ts-expect-error runtime guard coverage
      snapshot.nested.value = 'illegal';
    }).toThrow('testStore.nested.value');
    expect(() => {
      // @ts-expect-error runtime guard coverage
      delete snapshot.nested.value;
    }).toThrow('testStore.nested.value');
    expect(() => {
      // @ts-expect-error runtime guard coverage
      snapshot.items.push('illegal');
    }).toThrow('testStore.items.push');
  });

  it('takes ownership of values assigned by callers', () => {
    const external = {
      nested: { value: 1 },
      items: ['first'],
    };
    const controller = createPersistStore<{
      payload?: typeof external;
    }>(
      {
        name: 'ownership',
        template: {},
      },
      { enableDevMutationGuard: true },
    );

    controller.update(draft => {
      draft.payload = external;
    });

    expect(controller.getSnapshot().payload).toEqual(external);
    expect(controller.getSnapshot().payload).not.toBe(external);
    expect(controller.getSnapshot().payload?.nested).not.toBe(external.nested);
    expect(Object.isFrozen(external)).toBe(false);
    expect(Object.isFrozen(external.nested)).toBe(false);

    external.nested.value = 2;
    external.items.push('second');

    expect(controller.getSnapshot().payload).toEqual({
      nested: { value: 1 },
      items: ['first'],
    });
  });
});
