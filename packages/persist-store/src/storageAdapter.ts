import type { FieldNilable } from "@rabby-wallet/base-utils";

export type Primitive = string | number | boolean | null | undefined;
export type StorageItemTpl = { [P in string | number ]: Primitive | any | null };

export interface StorageAdapater<T extends StorageItemTpl = StorageItemTpl> {
  getItem<K extends keyof T>(key: string): T[K] | null | undefined
  // getAll(): FieldNilable<T>
  setItem<V>(key: keyof T, value: V): void
  removeItem(key: keyof T): void
  clearAll(): void
  flushToDisk?(): void
}

export interface StorageAdapaterOptions<T extends StorageItemTpl = StorageItemTpl> {
  storageAdapter?: StorageAdapater<StorageItemTpl>;
  beforePersist?: (store: FieldNilable<T>) => void;
}

export function makeMemoryStorage() {
  const memoryStore = new Map<string, any>();

  const storage: StorageAdapater<StorageItemTpl> = {
    getItem: (key: string) => memoryStore.get(key),
    // getAll: () => Object.fromEntries(memoryStore.entries()),
    setItem: (key: string, value: any) => { memoryStore.set(key, value) },
    removeItem: (key: string) => { memoryStore.delete(key) },
    clearAll: () => memoryStore.clear(),
  };

  return storage;
}
