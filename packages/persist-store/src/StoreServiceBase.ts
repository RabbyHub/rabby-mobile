import { FieldNilable } from "@rabby-wallet/base-utils";
import type { StorageAdapaterOptions, StorageItemTpl } from "./storageAdapter";
import createPersistStore from "./createPersistStore";

export class StoreServiceBase<
  StoreType extends Record<string, StorageItemTpl> = Record<string, StorageItemTpl>,
  StoreName extends string = string
> {
  private _storeName: StoreName;
  public get storeName () { return this._storeName; }

  protected _store: StoreType;
  public get store () { return this._store; }

  constructor(storeName: StoreName, tpl: StoreType, options: StorageAdapaterOptions<StoreType>) {
    this._storeName = storeName;
    this._store = createPersistStore<StoreType>(
      {
        name: storeName,
        template: tpl,
      },
      {
        storage: options.storageAdapter,
        beforeSetKV: this.onBeforeSetKV.bind(this),
      },
    );
  }

  protected onBeforeSetKV<K extends keyof StoreType>(k: K, value: FieldNilable<StoreType>[K]) {
    this?._beforeSetKV?.(k, value);
  }
  private _beforeSetKV?: (<K extends keyof StoreType>(k: K, value: FieldNilable<StoreType>[K]) => void) | null;
  public setBeforeSetKV(
    _beforeSetKV: <K extends keyof StoreType>(k: K, value: FieldNilable<StoreType>[K]) => void,
    retsDisposeFuncs: Function[] = [],
  ) {
    this._beforeSetKV = _beforeSetKV;

    // dispose
    const dispose = () => {
      this._beforeSetKV = null;
    };

    retsDisposeFuncs.push(dispose);

    return dispose;
  }
}
