// https://github.com/mrousavy/react-native-mmkv/blob/master/docs/WRAPPER_JOTAI.md
// AsyncStorage 有 bug，会闪白屏

import { MMKV, MMKVConfiguration } from 'react-native-mmkv';

import { stringUtils } from '@rabby-wallet/base-utils';
import { StorageAdapater } from '@rabby-wallet/persist-store';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import {
  SyncStorage,
  SyncStringStorage,
} from 'jotai/vanilla/utils/atomWithStorage';
import { MMKV_FILE_NAMES, walkThroughMMKVFiles } from '../utils/appFS';
import RNHelpers from '../native/RNHelpers';
import { IS_IOS } from '../native/utils';

function makeAppStorage(options?: MMKVConfiguration) {
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
    hasItem: (key: string): boolean => {
      return mmkv.contains(key);
    },
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
} = makeAppStorage({
  id: MMKV_FILE_NAMES.DEFAULT,
});

const { storage: keyringStorage } = makeAppStorage({
  id: MMKV_FILE_NAMES.KEYRING,
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

export const IS_BOOTED_USER =
  !!appStorage.getItem('keyringState') ||
  !!keyringStorage.getItem('keyringState');

export function makeJsonStore<T = any>(options?: {
  storage?: /* AsyncStringStorage |  */ SyncStringStorage;
}) {
  const { storage } = options || {};

  const jsonStore = storage
    ? createJSONStorage<T>(() => storage)
    : createJSONStorage<T>(() => ({
        getItem: appMethods.getItem,
        setItem: appMethods.setItem,
        removeItem: appMethods.removeItem,
        clearAll: appMethods.clearAll,
      }));

  return jsonStore;
}

export const appJsonStore = makeJsonStore<any>({
  storage: appStorage as SyncStringStorage,
});

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
  const jsonStore = makeJsonStore<T>({ storage });

  if (typeof options?.setupSubscribe === 'function') {
    jsonStore.subscribe = options?.setupSubscribe({ jsonStore });
  }

  return atomWithStorage<T>(key, initialValue, jsonStore);
};

const LEGACY_KEYS: string[] = [];
export function removeLegacyMMKVStorageByKey(key: `@${string}`) {
  if (!key.startsWith('@') || LEGACY_KEYS.includes(key)) {
    console.warn(
      `removeLegacyMMKVStorageByKey: key "${key}" is not a valid legacy key or already removed.`,
    );
    return;
  }

  if (appMethods.hasItem(key)) {
    console.debug(`removeLegacyMMKVStorageByKey: removing key "${key}"`);
    appMethods.removeItem(key);
    console.debug(`removeLegacyMMKVStorageByKey: key "${key}" removed.`);
  } else if (__DEV__) {
    console.warn(`removeLegacyMMKVStorageByKey: key "${key}" does not exist.`);
  }
}

// iife process
(async function ensureMmkvFilesNotBackupable() {
  if (!IS_IOS) return;

  walkThroughMMKVFiles(
    ({ fileBaseName, filePath, fileExist, crcFilePath, crcFileExist }) => {
      switch (fileBaseName) {
        default:
        case MMKV_FILE_NAMES.DEFAULT:
        case MMKV_FILE_NAMES.KEYRING:
        case MMKV_FILE_NAMES.KEYCHAIN: {
          if (fileExist) {
            RNHelpers.iosExcludeFileFromBackup(filePath).then(success => {
              __DEV__ &&
                console.debug(`${filePath} excluded from backup: %s`, success);
            });
          }

          if (crcFileExist) {
            RNHelpers.iosExcludeFileFromBackup(crcFilePath).then(success => {
              __DEV__ &&
                console.debug(
                  `${crcFilePath} excluded from backup: %s`,
                  success,
                );
            });
          }
          break;
        }
        case MMKV_FILE_NAMES.CHAINS:
          break;
      }
    },
  );
})();
