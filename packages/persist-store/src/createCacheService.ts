import type { FieldNilable } from '@rabby-wallet/base-utils';
import cloneDeep from 'lodash.clonedeep';

import type { CacheConfig, KVItem, GenCacheItemFromKV, GetKeyFromKV, GetValueConfiguration, ICacheService, SetValueConfiguration } from './CacheServiceBase';
import { type StorageItemTpl, type StorageAdapater, makeMemoryStorage } from './storageAdapter';


const DEFAULT_STORAGE = makeMemoryStorage();

export interface CreateCacheStoreParams<T extends StorageItemTpl> {
  name: string;
  template?: FieldNilable<T>;
  fromStorage?: boolean;
}

class CacheService<KV extends KVItem> implements ICacheService<KV> {
  private _config: CacheConfig<KV> = {
    genKey: () => {
      throw new Error('genKey not implemented');
    },
  };

  private _nsCache: Record<string, GenCacheItemFromKV<KVItem>> = Object.create(null);

  private _getNsCache(ns: string) {
    return this._nsCache[ns] || (this._nsCache[ns] = Object.create(null));
  }

  static formatNS(ns?: string) {
    return ns || 'defaultNS';
  }

  static formatTTL(ttl?: number) {
    if (Number.isNaN(ttl)) return 60 * 1e3;

    return typeof ttl === 'number' ? ttl : 60 * 1e3;
  }

  constructor(config?: CacheConfig<KV>) {
    if (config) {
      this.configure(config);
    }
  }

  configure(config: CacheConfig<KV>): void {
    this._config = {
      genKey: config.genKey,
    };

    this._config.namespace = CacheService.formatNS(config.namespace);
    // 60s
    this._config.ttl = CacheService.formatTTL(config.ttl);
  }

  setValue(key: GetKeyFromKV<KV>, value: KV[typeof key], config?: SetValueConfiguration<KV>): void {
    const { genKey } = {
      ...this._config,
      ...config,
    };

    const keyStr = typeof key === 'string' ? key : genKey({ params: [key] });
    const ns = CacheService.formatNS(this._config.namespace);

    const cacheNS = this._getNsCache(ns);

    cacheNS[keyStr] = {
      value,
      expire: Date.now() + CacheService.formatTTL(this._config.ttl),
    };
  }

  getValue(key: GetKeyFromKV<KV>, config?: GetValueConfiguration<KV>): KV[typeof key] | null {
    const { genKey } = {
      ...this._config,
      ...config,
    };

    const keyStr = typeof key === 'string' ? key : genKey({ params: [key] });
    const ns = CacheService.formatNS(this._config.namespace);

    const cacheNS = this._getNsCache(ns);

    const item = cacheNS[keyStr];

    if (!item) return null;

    if (item.expire < Date.now()) {
      delete cacheNS[keyStr];
      return null;
    }

    return item.value;
  }

  isExpired(key: GetKeyFromKV<KV>, config?: GetValueConfiguration<KV>): boolean {
    const finalConfig = { namespace: CacheService.formatNS(this._config.namespace || config?.namespace) };
    const keyStr = typeof key === 'string' ? key : this._config.genKey({ params: [key] });
    const cacheNS = this._getNsCache(finalConfig.namespace);

    const item = cacheNS[keyStr];

    if (!item) return true;

    return item.expire < Date.now();
  }

  remove(key: GetKeyFromKV<KV>, config?: GetValueConfiguration<KV>): { success: boolean } {
    const finalConfig = { namespace: CacheService.formatNS(this._config.namespace || config?.namespace) };
    const keyStr = typeof key === 'string' ? key : this._config.genKey({ params: [key] });
    const cacheNS = this._getNsCache(finalConfig.namespace);

    if (cacheNS[keyStr]) {
      delete cacheNS[keyStr];
      return { success: true };
    }

    return { success: false };
  }
}

export function createCacheService<T extends StorageItemTpl>({
  name,
  template = Object.create(null),
  fromStorage = true
}: CreateCacheStoreParams<T>, opts?: {
  // persistDebounce?: number;
  storage?: StorageAdapater<Record<string, StorageItemTpl>>;
  // beforePersist?: (obj: FieldNilable<T>) => void;
  // beforeSetKV?: <K extends string>(k: K, value: FieldNilable<T>[K]) => void;
}): ICacheService<T> {
  let tpl = template;

  const {
    // persistDebounce = 1000,
    storage = DEFAULT_STORAGE,
    // beforePersist,
    // beforeSetKV
  } = opts || {};

  if (fromStorage) {
    const storageCache = storage.getItem(name);
    tpl = Object.assign({}, template, storageCache);
    if (!storageCache) {
      storage.setItem(name, tpl);
    }
  }

  const original = cloneDeep(tpl) as FieldNilable<T>;

  return new CacheService<T>();
}
