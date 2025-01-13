type ReqFunc<U = any, P extends any[] = any[]> = (...args: P) => Promise<U>;

export interface GenerateKey<T extends ReqFunc>{
  (ctx: { params: Parameters<T> }): string
}

export interface CacheConfig<KV extends CacheItem, T extends any[] = any[]> {
  // Specify the key or specify how to generate the key
  genKey: GenerateKey<ReqFunc<any, T>>;
  // Default cache time, unit ms, the expiration time of the negotiated cache
  ttl?: number;
  // The namespace in which the cache is located, default is defaultNS
  namespace?: string;
}

export type KVItem = Record<string, any>;

type CacheItem = Record<string, {
  value: any;
  expire: number;
}>

export type GenCacheItemFromKV<KV extends KVItem> = {
  [K in keyof KV]: {
    value: KV[K];
    expire: number;
  }
}

export type SetValueConfiguration<KV extends KVItem> = Omit<CacheConfig<KV>, 'genKey'> & {
  key?: string | CacheConfig<KV>;
}

export type GetValueConfiguration<KV extends KVItem> = Pick<CacheConfig<KV>, 'namespace'>;

export type GetKeyFromKV<KV extends KVItem> = keyof KV;

export interface ICacheService<KV extends KVItem> {
  // constructor(config: CacheConfig): void;
  configure(config: CacheConfig<KV>): void;

  setValue(key: GetKeyFromKV<KV>, value: KV[typeof key], config?: SetValueConfiguration<KV>): void;
  getValue(key: GetKeyFromKV<KV>, config?: GetValueConfiguration<KV>): KV[typeof key] | null;

  remove(key: GetKeyFromKV<KV>, config?: GetValueConfiguration<KV>): { success: boolean; }
  isExpired(key: GetKeyFromKV<KV>, config?: GetValueConfiguration<KV>): boolean;
}
