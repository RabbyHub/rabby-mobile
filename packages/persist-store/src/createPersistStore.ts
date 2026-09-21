import cloneDeep from 'lodash.clonedeep';
import { apply, create, type Draft, type Patch, type Patches } from 'mutative';

import type { FieldNilable } from '@rabby-wallet/base-utils';

import {
  type StorageAdapater,
  type StorageItemTpl,
  type StorageSnapshot,
  makeMemoryStorage,
} from './storageAdapter';

declare const __DEV__: boolean | undefined;

const DEFAULT_STORAGE = makeMemoryStorage();
const MUTATING_ARRAY_METHODS = new Set([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
]);

type PersistStorePath = ReadonlyArray<string | number>;

export interface PersistStoreChange<T extends StorageItemTpl> {
  revision: number;
  previousState: StorageSnapshot<T>;
  state: StorageSnapshot<T>;
  patches: Patches<true>;
  inversePatches: Patches<true>;
  changedKeys: ReadonlyArray<Extract<keyof T, string | number>>;
  changedPaths: ReadonlyArray<PersistStorePath>;
}

export type PersistStoreListener<T extends StorageItemTpl> = (
  change: PersistStoreChange<T>,
) => void;

export interface PersistStoreController<T extends StorageItemTpl> {
  readonly name: string;
  getSnapshot(): StorageSnapshot<T>;
  update(recipe: (draft: Draft<T>) => void): StorageSnapshot<T>;
  subscribe(listener: PersistStoreListener<T>): () => void;
  subscribeField<K extends Extract<keyof T, string | number>>(
    key: K,
    listener: (
      value: StorageSnapshot<T>[K],
      previousValue: StorageSnapshot<T>[K],
      change: PersistStoreChange<T>,
    ) => void,
  ): () => void;
  flushNow(): void;
}

export interface CreatePersistStoreParams<T extends StorageItemTpl> {
  name: string;
  template?: FieldNilable<T>;
  fromStorage?: boolean;
}

export interface CreatePersistStoreOptions<T extends StorageItemTpl> {
  storage?: StorageAdapater<Record<string, StorageItemTpl>>;
  beforePersist?: (obj: StorageSnapshot<T>) => void;
  enableDevMutationGuard?: boolean;
  schedulePersist?: (task: () => void) => void;
}

function isPlainContainer(value: unknown): value is object {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return true;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function formatPath(storeName: string, path: PersistStorePath) {
  return [storeName, ...path].join('.');
}

function makeReadonlySnapshot<T extends StorageItemTpl>(
  snapshot: T,
  storeName: string,
): StorageSnapshot<T> {
  const proxies = new WeakMap<object, object>();

  const wrap = (value: unknown, path: PersistStorePath): unknown => {
    if (!isPlainContainer(value)) {
      return value;
    }

    const cached = proxies.get(value);
    if (cached) {
      return cached;
    }

    const mutationError = (property: PropertyKey): never => {
      const nextPath = [...path, String(property)];
      throw new TypeError(
        `[persist-store] Cannot mutate immutable snapshot at ${formatPath(
          storeName,
          nextPath,
        )}. Use update() or mutateStore() instead.`,
      );
    };

    const proxy = new Proxy(value, {
      get(target, property, receiver) {
        if (
          Array.isArray(target) &&
          typeof property === 'string' &&
          MUTATING_ARRAY_METHODS.has(property)
        ) {
          return () => mutationError(property);
        }

        return wrap(Reflect.get(target, property, receiver), [
          ...path,
          String(property),
        ]);
      },
      set(_target, property) {
        return mutationError(property);
      },
      deleteProperty(_target, property) {
        return mutationError(property);
      },
      defineProperty(_target, property) {
        return mutationError(property);
      },
      setPrototypeOf() {
        return mutationError('__proto__');
      },
    });

    proxies.set(value, proxy);
    return proxy;
  };

  return wrap(snapshot, []) as StorageSnapshot<T>;
}

function defaultSchedulePersist(task: () => void) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task);
    return;
  }

  void Promise.resolve().then(task);
}

function detachPatchValues(patches: Patches<true>): Patches<true> {
  return patches.map(
    (patch): Patch<true> =>
      'value' in patch
        ? {
            ...patch,
            value: cloneDeep(patch.value),
          }
        : { ...patch },
  );
}

const createPersistStore = <T extends StorageItemTpl>(
  {
    name,
    template = Object.create(null),
    fromStorage = true,
  }: CreatePersistStoreParams<T>,
  opts?: CreatePersistStoreOptions<T>,
): PersistStoreController<T> => {
  const {
    storage = DEFAULT_STORAGE,
    beforePersist,
    enableDevMutationGuard = typeof __DEV__ !== 'undefined' ? __DEV__ : false,
    schedulePersist = defaultSchedulePersist,
  } = opts || {};

  const storageCache = fromStorage ? storage.getItem(name) : null;
  const initialState = cloneDeep(
    Object.assign({}, template, storageCache || {}),
  ) as T;

  if (fromStorage && !storageCache) {
    storage.setItem(name, initialState);
  }

  let state = initialState;
  let exposedState = enableDevMutationGuard
    ? makeReadonlySnapshot(state, name)
    : (state as StorageSnapshot<T>);
  let revision = 0;
  let pendingRevision = 0;
  let persistedRevision = 0;
  let scheduledFlushId = 0;
  let flushScheduled = false;
  const listeners = new Set<PersistStoreListener<T>>();

  const persistPendingState = () => {
    flushScheduled = false;
    if (pendingRevision <= persistedRevision) {
      return;
    }

    const revisionToPersist = pendingRevision;
    const stateToPersist = state;
    beforePersist?.(
      enableDevMutationGuard
        ? makeReadonlySnapshot(stateToPersist, name)
        : (stateToPersist as StorageSnapshot<T>),
    );
    storage.setItem(name, stateToPersist);
    persistedRevision = revisionToPersist;

    if (pendingRevision > persistedRevision) {
      scheduleFlush();
    }
  };

  const scheduleFlush = () => {
    if (flushScheduled) {
      return;
    }

    flushScheduled = true;
    const flushId = ++scheduledFlushId;
    schedulePersist(() => {
      if (flushId !== scheduledFlushId) {
        return;
      }
      persistPendingState();
    });
  };

  const controller: PersistStoreController<T> = {
    name,
    getSnapshot() {
      return exposedState;
    },
    update(recipe) {
      const previousState = state;
      const [, sourcePatches, sourceInversePatches] = create(state, recipe, {
        enablePatches: true,
        enableAutoFreeze: false,
      });

      if (sourcePatches.length === 0) {
        return exposedState;
      }

      const patches = detachPatchValues(sourcePatches);
      const inversePatches = detachPatchValues(sourceInversePatches);
      state = apply(state, patches, {
        enableAutoFreeze: false,
      }) as T;
      exposedState = enableDevMutationGuard
        ? makeReadonlySnapshot(state, name)
        : (state as StorageSnapshot<T>);
      revision += 1;
      pendingRevision = revision;

      const changedPaths = patches.map(patch => patch.path);
      const changedKeys = Array.from(
        new Set(
          changedPaths
            .map(path => path[0])
            .filter(
              (key): key is Extract<keyof T, string | number> =>
                key !== undefined,
            ),
        ),
      );
      const previousExposedState = enableDevMutationGuard
        ? makeReadonlySnapshot(previousState, name)
        : (previousState as StorageSnapshot<T>);
      const change: PersistStoreChange<T> = {
        revision,
        previousState: previousExposedState,
        state: exposedState,
        patches,
        inversePatches,
        changedKeys,
        changedPaths,
      };

      scheduleFlush();
      Array.from(listeners).forEach(listener => listener(change));
      return exposedState;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeField(key, listener) {
      return controller.subscribe(change => {
        if (!change.changedKeys.includes(key)) {
          return;
        }
        listener(change.state[key], change.previousState[key], change);
      });
    },
    flushNow() {
      scheduledFlushId += 1;
      persistPendingState();
      storage.flushToDisk?.();
    },
  };

  return controller;
};

export default createPersistStore;
