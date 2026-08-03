import type { Draft } from 'mutative';
import cloneDeep from 'lodash.clonedeep';

import type { FieldNilable } from '@rabby-wallet/base-utils';

import createPersistStore, {
  type PersistStoreChange,
  type PersistStoreController,
  type PersistStoreListener,
} from './createPersistStore';
import type {
  StorageAdapaterOptions,
  StorageItemTpl,
  StorageSnapshot,
} from './storageAdapter';

export class StoreServiceBase<
  StoreType extends StorageItemTpl = StorageItemTpl,
  StoreName extends string = string,
> {
  private _storeName?: StoreName;
  public get storeName(): StoreName {
    if (!this._storeName) {
      throw new Error('[persist-store] Store service is not initialized.');
    }

    return this._storeName;
  }

  private _persistStore?: PersistStoreController<StoreType>;
  public get store(): StorageSnapshot<StoreType> {
    return this.getPersistStore().getSnapshot();
  }

  public getStoreSnapshot(): StoreType {
    return cloneDeep(this.store) as StoreType;
  }

  public getStoreFieldSnapshot<K extends keyof StoreType>(
    key: K,
  ): StoreType[K] {
    return cloneDeep(this.store[key]) as StoreType[K];
  }

  constructor(
    storeName?: StoreName,
    tpl?: StoreType,
    options: StorageAdapaterOptions<StoreType> = {},
  ) {
    if (storeName !== undefined && tpl !== undefined) {
      this.initializePersistStore(storeName, tpl, options);
    }
  }

  protected initializePersistStore(
    storeName: StoreName,
    tpl: StoreType,
    options: StorageAdapaterOptions<StoreType> = {},
  ) {
    this._storeName = storeName;
    this._persistStore = createPersistStore<StoreType>(
      {
        name: storeName,
        template: tpl,
      },
      {
        storage: options.storageAdapter,
        beforePersist: options.beforePersist,
      },
    );

    return this._persistStore.getSnapshot();
  }

  private getPersistStore() {
    if (!this._persistStore) {
      throw new Error('[persist-store] Store service is not initialized.');
    }

    return this._persistStore;
  }

  protected mutateStore(recipe: (draft: Draft<StoreType>) => void) {
    return this.getPersistStore().update(recipe);
  }

  public subscribeStore(listener: PersistStoreListener<StoreType>) {
    return this.getPersistStore().subscribe(listener);
  }

  public subscribeStoreField<
    K extends Extract<keyof StoreType, string | number>,
  >(
    key: K,
    listener: (
      value: StorageSnapshot<StoreType>[K],
      previousValue: StorageSnapshot<StoreType>[K],
      change: PersistStoreChange<StoreType>,
    ) => void,
  ) {
    return this.getPersistStore().subscribeField(key, listener);
  }

  public subscribeStoreFields(
    listener: <K extends keyof StoreType>(
      key: K,
      value: FieldNilable<StoreType>[K],
    ) => void,
  ) {
    return this.subscribeStore(change => {
      change.changedKeys.forEach(key => {
        listener(
          key,
          cloneDeep(change.state[key]) as FieldNilable<StoreType>[typeof key],
        );
      });
    });
  }

  public flushStore() {
    this.getPersistStore().flushNow();
  }
}
