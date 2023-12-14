// https://github.com/mrousavy/react-native-mmkv/blob/master/docs/WRAPPER_JOTAI.md
// AsyncStorage 有 bug，会闪白屏

import { StorageAdapater } from '@rabby-wallet/persist-store';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

function getItem<T>(key: string): T | null {
  const value = storage.getString(key);
  return value ? JSON.parse(value) : null;
}

function setItem<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

function removeItem(key: string): void {
  storage.delete(key);
}

function clearAll(): void {
  storage.clearAll();
}

let appStorage: StorageAdapater;
export function makeAppStorage() {
  if (!appStorage) {
    appStorage = {
      getItem: (key: string) => getItem(key),
      setItem: (key: string, value: any) => {
        setItem(key, value);
      },
      clearAll: () => clearAll(),
    };
  }

  return appStorage;
}

export const atomWithMMKV = <T = any>(key: string, initialValue: T) =>
  atomWithStorage<T>(
    key,
    initialValue,
    createJSONStorage<T>(() => ({
      getItem,
      setItem,
      removeItem,
      clearAll,
    })),
  );
