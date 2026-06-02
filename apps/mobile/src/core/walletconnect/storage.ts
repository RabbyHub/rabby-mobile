import type { IKeyValueStorage } from '@walletconnect/keyvaluestorage';
import { safeJsonParse, safeJsonStringify } from '@walletconnect/safe-json';
import { walletConnectMMKV } from '@/core/storage/mmkvInstances';

function parseWalletConnectStorageValue<T>(value: string) {
  return safeJsonParse<T>(value) as T;
}

export const walletConnectStorage: IKeyValueStorage = {
  async getKeys() {
    return walletConnectMMKV.getAllKeys();
  },

  async getEntries<T = any>() {
    return walletConnectMMKV.getAllKeys().map(key => {
      const value = walletConnectMMKV.getString(key) ?? '';
      return [key, parseWalletConnectStorageValue<T>(value)] as [string, T];
    });
  },

  async getItem<T = any>(key: string) {
    const value = walletConnectMMKV.getString(key);
    if (typeof value !== 'string') {
      return undefined;
    }

    return parseWalletConnectStorageValue<T>(value);
  },

  async setItem<T = any>(key: string, value: T) {
    walletConnectMMKV.set(key, safeJsonStringify(value));
  },

  async removeItem(key: string) {
    walletConnectMMKV.delete(key);
  },
};
