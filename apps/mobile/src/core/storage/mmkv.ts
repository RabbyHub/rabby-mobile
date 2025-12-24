// https://github.com/mrousavy/react-native-mmkv/blob/master/docs/WRAPPER_JOTAI.md
// AsyncStorage 有 bug，会闪白屏

import { MMKV, MMKVConfiguration } from 'react-native-mmkv';

import { stringUtils } from '@rabby-wallet/base-utils';
import { StorageAdapater } from '@rabby-wallet/persist-store';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import {
  type SyncStorage,
  type SyncStringStorage,
} from 'jotai/vanilla/utils/atomWithStorage';
import { type StateStorage } from 'zustand/middleware';

import { MMKV_FILE_NAMES, walkThroughMMKVFiles } from '../utils/appFS';
import RNHelpers from '../native/RNHelpers';
import { IS_IOS } from '../native/utils';
import { runDevIIFEFunc } from '../utils/store';
import { reactotronEvents } from '../utils/reactotron-plugins/_utils';
import { zCreate, zCreateJSONStorage, zPersist } from '../utils/reexports';
// import { lendingCacheStorage } from '@/screens/Lending/hooks';

function checkIfDuplicatedStringifiedJsonObjectString(input: any) {
  return (
    typeof input === 'string' &&
    (input.startsWith('"{\\') || input.startsWith('"['))
  );
}

const STUB = JSON.stringify(JSON.stringify('foo'));
const STUB_START = STUB.slice(0, 3);
const STUB_END = STUB.slice(-3);
function checkIfDuplicatedStringifiedJsonString(input: any) {
  return (
    typeof input === 'string' &&
    input.startsWith(STUB_START) &&
    input.endsWith(STUB_END)
  );
}

export function getJsonValueStringCompat(
  mmkv: MMKV,
  key: string,
  options?: MMKVConfiguration,
): string | null {
  const raw = mmkv.getString(key);
  if (!raw) return null;
  let finalString: string | null = raw;

  try {
    if (checkIfDuplicatedStringifiedJsonObjectString(raw)) {
      finalString = stringUtils.safeParseJSON(raw, {
        defaultValue: raw,
      });
    } else if (checkIfDuplicatedStringifiedJsonString(raw)) {
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

export function makeMMKVStorage(options?: MMKVConfiguration) {
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

  function setRawString(key: string, value: string): void {
    mmkv.set(key, value);
  }

  function getRawString(key: string): string | null {
    return mmkv.getString(key) ?? null;
  }

  const methods = {
    getItem,
    setItem,
    getJsonValueStringCompat: (key: string) =>
      getJsonValueStringCompat(mmkv, key, options),
    removeItem,
    setRawString,
    getRawString,
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
} = makeMMKVStorage({
  id: MMKV_FILE_NAMES.DEFAULT,
});

const { storage: keyringStorage, mmkv: keyringMMKV } = makeMMKVStorage({
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

export const appMMKVForDebug = __DEV__
  ? appMMKV
  : (null as any as typeof appMMKV);
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
type PresetStringStorageOption =
  /** @deprecated */
  | MMKVStorageStrategy.legacy
  | MMKVStorageStrategy.compatJson
  | MMKVStorageStrategy.compatString;

function isPresetStorageStrategy(
  storage?:
    | PresetStringStorageOption
    | JotaiStringStorageOption
    | ZustandStringStorageOption,
): storage is
  | MMKVStorageStrategy.legacy
  | MMKVStorageStrategy.compatJson
  | MMKVStorageStrategy.compatString {
  return (
    storage === MMKVStorageStrategy.legacy ||
    storage === MMKVStorageStrategy.compatJson ||
    storage === MMKVStorageStrategy.compatString
  );
}

type JotaiStringStorageOption = SyncStringStorage | PresetStringStorageOption;
/**
 * @deprecated
 * persist item as json, read it as its original type
 *
 * @baddesign In the past, `makeJotaiJsonStore` use storage consist with appStorage,
 * which also persist value as json, and treat it as json on parsing. This duplicates
 * the logic of `makeJotaiJsonStore`, and is not a good design, that is, one value would
 * be JSON.stringify twice and JSON.parse twice. This is a bad behavior.
 */
export function makeJotaiJsonStore<T = any>(options?: {
  methods?: Pick<
    ReturnType<typeof makeMMKVStorage>['methods'],
    'getRawString' | 'setRawString' | 'removeItem' | 'clearAll'
  >;
  storage?: JotaiStringStorageOption;
}) {
  const { methods = appMethods, storage } = options || {};

  const jsonStore = isPresetStorageStrategy(storage)
    ? createJSONStorage<T>(() => GET_STRING_STORAGE_FOR_JSON_STORE(storage))
    : storage
    ? createJSONStorage<T>(() => storage)
    : createJSONStorage<T>(() => ({
        getItem: methods.getRawString,
        setItem: methods.setRawString,
        removeItem: methods.removeItem,
        clearAll: methods.clearAll,
      }));

  return jsonStore;
}

/**
 * @deprecated
 */
export const duplicatelyStringifiedAppJsonStore = makeJotaiJsonStore<any>({
  storage: appStorage as SyncStringStorage,
});

export const appJsonStore = makeJotaiJsonStore<any>({
  storage: undefined,
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

export const appStorageForZustand = GET_STRING_STORAGE_FOR_JSON_STORE(
  MMKVStorageStrategy.compatJson,
);

export const atomByMMKV = <T = any>(
  key: string,
  initialValue: T,
  options?: {
    storage?: JotaiStringStorageOption;
    setupSubscribe?(ctx: {
      jsonStore: SyncStorage<T>;
    }): /* subscribe */ SyncStorage<T>['subscribe'] & Function;
  },
) => {
  const { storage } = options || {};
  const jsonStore = makeJotaiJsonStore<T>({ storage });

  if (typeof options?.setupSubscribe === 'function') {
    jsonStore.subscribe = options?.setupSubscribe({ jsonStore });
  }

  return atomWithStorage<T>(key, initialValue, jsonStore);
};

const defaultMigrateFromAtom: MigrateFromAtom<any> = ctx => {
  const newData = { state: ctx.oldData, version: 0 };
  appJsonStore.setItem(ctx.key, newData);

  return { migrated: newData };
};
type MigrateFromAtom<T> = (ctx: {
  key: string;
  // legacyAppStoreKey: string;
  oldData: any;
  appJsonStore: typeof appJsonStore;
}) => { migrated: T; trimLegacyKey?: boolean };
type ZustandStringStorageOption = StateStorage | PresetStringStorageOption;
export const zustandByMMKV = <T = any>(
  key: string,
  initialValue: T,
  options?: {
    legacyAppStoreKey?: string;
    migrateFromAtom?: MigrateFromAtom<T>;
    storage: ZustandStringStorageOption;
  },
) => {
  const {
    storage,
    legacyAppStoreKey = key,
    migrateFromAtom = defaultMigrateFromAtom,
  } = options || {};
  const store =
    (isPresetStorageStrategy(storage)
      ? GET_STRING_STORAGE_FOR_JSON_STORE(storage)
      : storage) || appStorageForZustand;

  const oldData = appJsonStore.getItem(legacyAppStoreKey, initialValue);
  const newData =
    key === legacyAppStoreKey
      ? oldData
      : appJsonStore.getItem(key, initialValue);
  const hasMigrated =
    newData?.hasOwnProperty('state') && newData?.hasOwnProperty('version');

  if (!hasMigrated) {
    const result = migrateFromAtom({ key, oldData, appJsonStore });
    if (key !== legacyAppStoreKey || result.trimLegacyKey) {
      removeLegacyMMKVStorageByKey(legacyAppStoreKey as any);
    }
  }

  const zustandStore = zCreate(
    zPersist<T>(
      () => ({
        ...initialValue,
        // use old state
        ...(!hasMigrated && oldData),
      }),
      {
        name: key,
        storage: zCreateJSONStorage(() => store),
      },
    ),
  );

  return zustandStore;
};

export function removeLegacyMMKVStorageByKey(key: `@${string}`) {
  if (!key.startsWith('@')) {
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

runDevIIFEFunc(() => {
  const logStorage = (
    storage: typeof appJsonStore | typeof keyringStorage,
    // | typeof lendingCacheStorage,
  ) => {
    const allKeys = appMMKVForDebug.getAllKeys();
    console.debug('Reactotron MMKV Store keys', allKeys);
    const dump: Record<string, any> = {};
    allKeys.forEach(key => {
      dump[key] = storage.getItem(key, null);
    });
    console.debug('Reactotron MMKV Store: appStore', dump);
  };
  reactotronEvents.subscribe('CM_LOG_MMKV_STORE', ({ mmkvName }) => {
    switch (mmkvName) {
      default:
      case 'a':
      case 'app':
      case 'appStore': {
        logStorage(appJsonStore);
        break;
      }
      case 'k':
      case 'keyring':
      case 'keyringStore': {
        logStorage(keyringStorage);
        break;
      }
      case 'l':
      case 'lending':
      case 'lendingDataCache': {
        // logStorage(lendingCacheStorage);
        break;
      }
    }
  });
});
