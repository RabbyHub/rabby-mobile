// https://github.com/mrousavy/react-native-mmkv/blob/master/docs/WRAPPER_JOTAI.md
// AsyncStorage 有 bug，会闪白屏

import { MMKV, MMKVConfiguration } from 'react-native-mmkv';

import { stringUtils } from '@rabby-wallet/base-utils';
import { StorageAdapater } from '@rabby-wallet/persist-store';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import {
  AsyncStringStorage,
  SyncStorage,
  SyncStringStorage,
} from 'jotai/vanilla/utils/atomWithStorage';

export function makeAppStorage(options?: MMKVConfiguration) {
  const mmkv = new MMKV(options);

  function getItem<T>(key: string): T | null {
    const value = mmkv.getString(key);

    return !value
      ? null
      : stringUtils.safeParseJSON(value, { defaultValue: null });
  }

  function setItem<T>(key: string, value: T): void {
    mmkv.set(key, JSON.stringify(value));
  }

  function removeItem(key: string): void {
    mmkv.delete(key);
  }

  function clearAll(): void {
    mmkv.clearAll();
  }

  const storage: StorageAdapater = {
    getItem,
    setItem,
    removeItem,
    clearAll,
    flushToDisk: () => {
      mmkv.trim();
    },
  };

  const methods = {
    getItem,
    setItem,
    removeItem,
    clearAll,
  };

  return {
    storage,
    methods,
    mmkv,
  };
}

const {
  storage: appStorage,
  methods: appMethods,
  mmkv: appMMKV,
} = makeAppStorage();
const { storage: keyringStorage } = makeAppStorage({
  id: 'mmkv.keyring',
  encryptionKey: 'keyring',
});

export function normalizeKeyringState() {
  const legacyData = appStorage.getItem('keyringState');
  const result = {
    legacyData,
    keyringData: keyringStorage.getItem('keyringState') || legacyData,
  };

  if (legacyData) appMMKV.trim();

  // console.debug('result.legacyData', result.legacyData);
  // console.debug('result.keyringData', result.keyringData);
  if (!result.legacyData) return result;

  keyringStorage.setItem('keyringState', result.legacyData);
  result.keyringData = result.legacyData;

  appStorage.removeItem('keyringState');
  appMMKV.trim();

  return result;
}

export { appStorage, keyringStorage };

export const atomByMMKV = <T = any>(
  key: string,
  initialValue: T,
  options?: {
    storage?: /* AsyncStringStorage |  */ SyncStringStorage;
    setupSubscribe?(ctx: {
      jsonStore: SyncStorage<T>;
    }): /* subscribe */ SyncStorage<T>['subscribe'] & Function;
  },
) => {
  const { storage } = options || {};
  const jsonStore = storage
    ? createJSONStorage<T>(() => storage)
    : createJSONStorage<T>(() => ({
        getItem: appMethods.getItem,
        setItem: appMethods.setItem,
        removeItem: appMethods.removeItem,
        clearAll: appMethods.clearAll,
      }));

  if (typeof options?.setupSubscribe === 'function') {
    jsonStore.subscribe = options?.setupSubscribe({ jsonStore });
  }

  return atomWithStorage<T>(key, initialValue, jsonStore);
};
