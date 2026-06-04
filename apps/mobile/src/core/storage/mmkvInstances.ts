import { MMKV } from 'react-native-mmkv';
import { MMKV_FILE_NAMES } from './mmkvConstants';

export const appMMKV = new MMKV({
  id: MMKV_FILE_NAMES.DEFAULT,
});

export const keyringMMKV = new MMKV({
  id: MMKV_FILE_NAMES.KEYRING,
  encryptionKey: 'keyring',
});

export const keychainMMKV = new MMKV({
  id: MMKV_FILE_NAMES.KEYCHAIN,
});

export const chainsMMKV = new MMKV({
  id: MMKV_FILE_NAMES.CHAINS,
});

export const dayCurveMMKV = new MMKV({
  id: MMKV_FILE_NAMES.DAYCURVE,
});

export const cexIdMMKV = new MMKV({
  id: MMKV_FILE_NAMES.CEXID,
});

export const balance24hMMKV = new MMKV({
  id: MMKV_FILE_NAMES.BALANCE_24H,
});

export const testnetBalanceMMKV = new MMKV({
  id: MMKV_FILE_NAMES.TESTNET_BALANCE,
});

export const lendingDataCacheMMKV = new MMKV({
  id: MMKV_FILE_NAMES.LENDING_DATA_CACHE,
});

export const ALL_KNOWN_MMKV_INSTANCES = {
  [MMKV_FILE_NAMES.DEFAULT]: appMMKV,
  [MMKV_FILE_NAMES.KEYCHAIN]: keychainMMKV,
  [MMKV_FILE_NAMES.KEYRING]: keyringMMKV,
  [MMKV_FILE_NAMES.CHAINS]: chainsMMKV,
  [MMKV_FILE_NAMES.DAYCURVE]: dayCurveMMKV,
  [MMKV_FILE_NAMES.CEXID]: cexIdMMKV,
  [MMKV_FILE_NAMES.BALANCE_24H]: balance24hMMKV,
  [MMKV_FILE_NAMES.TESTNET_BALANCE]: testnetBalanceMMKV,
  [MMKV_FILE_NAMES.LENDING_DATA_CACHE]: lendingDataCacheMMKV,
} as const;
