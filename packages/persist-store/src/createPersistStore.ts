/* eslint-disable @typescript-eslint/ban-types */
import { reactive, effect as reffect, type UnwrapNestedRefs } from '@vue/reactivity';
import cloneDeep from 'lodash.clonedeep';

import { FieldNilable } from '@rabby-wallet/base-utils';

import debounce from 'debounce';
import { StorageItemTpl, StorageAdapater, makeMemoryStorage } from './storageAdapter';

const DEFAULT_STORAGE = makeMemoryStorage();

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
}) => {
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

  const original = cloneDeep(tpl) as FieldNilable<T>;
  const store = reactive(original);

  // support nested
  reffect(() => {
    persistStorage(name, original);
  });

  return store as T;
};

export default createPersistStore;
