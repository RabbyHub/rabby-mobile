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

function checkIfDuplicatedStringifiedJsonObjectString(input: any) {
  return (
    typeof input === 'string' &&
    (input.startsWith('"{\\') || input.startsWith('"['))
  );
}

function checkIfJsonStringifiedString(input: any) {
  return typeof input === 'string' && input.startsWith('"');
}

export function makeAppStorage(options?: MMKVConfiguration) {
  const mmkv = new MMKV(options);

  function getItem<T>(key: string): T | null {
    const value = mmkv.getString(key);

    return !value
      ? null
      : stringUtils.safeParseJSON(value, { defaultValue: null });
  }

  function getJsonValueStringCompat(key: string): string | null {
    const raw = mmkv.getString(key);
    if (!raw) return null;
    let finalString: string | null = null;

    try {
      if (checkIfDuplicatedStringifiedJsonObjectString(raw)) {
        finalString = stringUtils.safeParseJSON(raw, {
          defaultValue: raw,
        });
      } else if (checkIfJsonStringifiedString(raw)) {
        finalString = stringUtils.safeParseJSON(raw, {
          defaultValue: raw,
        });
      }
    } catch (e) {
      if (__DEV__) {
        console.warn(
          `[getJsonValueStringCompat::${options?.id}] Failed to parse item with key "${key}":`,
          e,
        );
      }
    }

    return finalString ?? null;
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

  function setRawString(key: string, value: string): void {
    mmkv.set(key, value);
  }

  function getRawString(key: string): string | null {
    return mmkv.getString(key) ?? null;
  }

  const methods = {
    getItem,
    setItem,
    getJsonValueStringCompat,
    removeItem,
    setRawString,
    getRawString,
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

export const enum MMKVStorageStrategy {
  'legacy' = -1,
  'compatJson' = 0,
  'compatString' = 1,
  'next' = 11,
}
type StringStorageOption =
  /* AsyncStringStorage |  */
  | SyncStringStorage
  /** @deprecated */
  | MMKVStorageStrategy.legacy
  | MMKVStorageStrategy.compatJson
  | MMKVStorageStrategy.compatString;
/**
 * persist item as json, read it as its original type
 *
 * @baddesign In the past, `makeJsonStore` use storage consist with appStorage,
 * which also persist value as json, and treat it as json on parsing. This duplicates
 * the logic of `makeJsonStore`, and is not a good design, that is, one value would
 * be JSON.stringify twice and JSON.parse twice. This is a bad behavior.
 */
function makeJsonStore<T = any>(options?: { storage?: StringStorageOption }) {
  const { storage } = options || {};

  const jsonStore =
    storage === MMKVStorageStrategy.legacy ||
    storage === MMKVStorageStrategy.compatJson ||
    storage === MMKVStorageStrategy.compatString
      ? createJSONStorage<T>(() => GET_STRING_STORAGE_FOR_JSON_STORE(storage))
      : storage
      ? createJSONStorage<T>(() => storage)
      : createJSONStorage<T>(() => ({
          getItem: appMethods.getRawString,
          setItem: appMethods.setRawString,
          removeItem: appMethods.removeItem,
          clearAll: appMethods.clearAll,
        }));

  return jsonStore;
}

/**
 * @deprecated
 */
export const duplicatelyStringifiedAppJsonStore = makeJsonStore<any>({
  storage: appStorage as SyncStringStorage,
});

const GET_STRING_STORAGE_FOR_JSON_STORE = (strategy: MMKVStorageStrategy) => {
  switch (strategy) {
    case MMKVStorageStrategy.legacy: {
      return {
        getItem: appMethods.getItem,
        setItem: appMethods.setItem,
        removeItem: appMethods.removeItem,
      };
    }
    case MMKVStorageStrategy.compatJson:
    case MMKVStorageStrategy.compatString: {
      return {
        getItem: appMethods.getJsonValueStringCompat,
        setItem: appMethods.setRawString,
        removeItem: appMethods.removeItem,
      };
    }
    default: {
      return {
        getItem: appMethods.getRawString,
        setItem: appMethods.setRawString,
        removeItem: appMethods.removeItem,
      };
    }
  }
};

export const atomByMMKV = <T = any>(
  key: string,
  initialValue: T,
  options?: {
    storage?: StringStorageOption;
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
