/* eslint-disable @typescript-eslint/ban-types */
import { EffectScope, effect as reffect, reactive, ReactiveEffectRunner } from '@vue/reactivity';
import cloneDeep from 'lodash.clonedeep';

import { FieldNilable } from '@rabby-wallet/base-utils';

import debounce from 'debounce';
import { StorageItemTpl, StorageAdapater, makeMemoryStorage } from './storageAdapter';

const DEFAULT_STORAGE = makeMemoryStorage();

function trackField<T extends object>(source: T, stub: object, key: string | string[]) {
  const keys = Array.isArray(key) ? key : [key];
  keys.forEach((key) => {
    // @ts-expect-error
    stub[key] = source[key];
  });

  return keys;
}

class FieldsEffector {
  #tplFields: Set<string>;
  increamentalFields = new Map<string, ReactiveEffectRunner>();

  constructor ({ tplFields }: {
    tplFields: string[];
  }) {
    this.#tplFields = new Set(tplFields);
  }

  isTrackedField(key: string) {
    return this.#tplFields.has(key) || this.increamentalFields.has(key);
  }

  addEffector(key: string, effector: ReactiveEffectRunner) {
    if (this.#tplFields.has(key)) {
      /* istanbul ignore next */
      throw new Error(`[FieldsEffector::addEffector] Field ${key} is already tracked on initialization`);
    }

    this.increamentalFields.set(key, effector);
  }

  removeEffector(key: string) {
    this.increamentalFields.delete(key);
  }
}

export interface CreatePersistStoreParams<T extends StorageItemTpl> {
  name: string;
  template?: FieldNilable<T>;
  fromStorage?: boolean;
}

const createPersistStore = <T extends StorageItemTpl>({
  name,
  template = Object.create(null),
  fromStorage = true
}: CreatePersistStoreParams<T>, opts?: {
  persistDebounce?: number;
  storage?: StorageAdapater<Record<string, StorageItemTpl>>;
  beforePersist?: (obj: FieldNilable<T>) => void;
  beforeSetKV?: <K extends string>(k: K, value: FieldNilable<T>[K]) => void;
}) => {
  let tpl = template;

  const {
    persistDebounce = 1000,
    storage = DEFAULT_STORAGE,
    beforePersist,
    beforeSetKV
  } = opts || {};

  if (fromStorage) {
    const storageCache = storage.getItem(name);
    tpl = Object.assign({}, template, storageCache);
    if (!storageCache) {
      storage.setItem(name, tpl);
    }
  }

  const persistStorage = debounce((name: string, obj: FieldNilable<T>) => {
    beforePersist?.(obj);
    storage.setItem(name, obj);
  }, persistDebounce, { immediate: false });

  const original = cloneDeep(tpl) as FieldNilable<T>;

  const fieldEffector = new FieldsEffector({ tplFields: Object.keys(tpl) });
  const effectScope = new EffectScope();
  const trackStub = {};

  const rstore = effectScope.run(() => {
    const store = new Proxy<FieldNilable<T>>(original, {
      set(target: any, prop: string, value) {
        if (!fieldEffector.isTrackedField(prop)) {
          fieldEffector.addEffector(prop, reffect(() => {
            trackField(target, trackStub, prop);
          }));
        }

        beforeSetKV?.(prop, value);

        target[prop] = value;
        persistStorage(name, target);

        return true;
      },

      deleteProperty(target, prop: string) {
        if (Reflect.has(target, prop)) {
          fieldEffector.removeEffector(prop);

          beforeSetKV?.(prop, undefined);

          Reflect.deleteProperty(target, prop);
          persistStorage(name, target);
        }

        return true;
      },
    });
    const rstore = reactive(store);

    let initTracked = false;
    // TODO: support nested?
    reffect(() => {
      if (!initTracked) {
        // add stub here to ref rstore
        trackField(rstore, trackStub, Object.keys(rstore));
        initTracked = true;
      }

      persistStorage(name, original);
    });

    return rstore;
  });

  return rstore as T;
};

export default createPersistStore;
