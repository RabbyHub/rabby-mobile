/* eslint-disable @typescript-eslint/ban-types */

import debounce from 'debounce';
import { StorageItemTpl, StorageAdapater, makeMemoryStorage, FieldNilable } from './storageAdapter';

const DEFAULT_STORAGE = makeMemoryStorage();

export interface CreatePersistStoreParams<T extends StorageItemTpl> {
  name: string;
  template?: FieldNilable<T>;
  fromStorage?: boolean;
  storage?: StorageAdapater<Record<string, T>>;
}

const createPersistStore = async <T extends StorageItemTpl>({
  name,
  template = Object.create(null),
  fromStorage = true,
}: CreatePersistStoreParams<T>, opts?: {
  persistDebounce?: number;
  storage?: StorageAdapater<Record<string, StorageItemTpl>>;
},): Promise<FieldNilable<T>> => {
  let tpl = template;

  const {
    persistDebounce = 1000,
    storage = DEFAULT_STORAGE
  } = opts || {};

  if (fromStorage) {
    const storageCache = storage.getItem(name);
    tpl = Object.assign({}, template, storageCache);
    if (!storageCache) {
      storage.setItem(name, tpl);
    }
  }

  const persistStorage = debounce((name: string, obj: FieldNilable<T>) => storage.setItem(name, obj), persistDebounce);

  const store = new Proxy<FieldNilable<T>>(tpl, {
    set(target: any, prop, value) {
      target[prop] = value;

      persistStorage(name, target);

      return true;
    },

    deleteProperty(target, prop) {
      if (Reflect.has(target, prop)) {
        Reflect.deleteProperty(target, prop);

        persistStorage(name, target);
      }

      return true;
    },
  });

  return store as any;
};

export default createPersistStore;
