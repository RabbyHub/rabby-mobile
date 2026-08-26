import { MMKV } from 'react-native-mmkv';
import { ASSET_SYNC_PERSISTENCE_QUEUE_STORAGE_ID } from '@rabby-wallet/asset-sync-worker-core';
import { MMKV_FILE_NAMES } from './mmkvConstants';

export const appMMKV = new MMKV({
  id: MMKV_FILE_NAMES.DEFAULT,
});

/** The established encrypted primary keyring file. */
export const keyringMMKV = new MMKV({
  id: MMKV_FILE_NAMES.KEYRING,
  encryptionKey: 'keyring',
});

/** One-generation encrypted rollback point for the established primary. */
export const keyringCheckpointMMKV = new MMKV({
  id: MMKV_FILE_NAMES.KEYRING_CHECKPOINT,
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

export const walletConnectMMKV = new MMKV({
  id: MMKV_FILE_NAMES.WALLETCONNECT,
  encryptionKey: 'walletconnect',
});

export const lendingDataCacheMMKV = new MMKV({
  id: MMKV_FILE_NAMES.LENDING_DATA_CACHE,
});

export const assetSyncPersistenceQueueMMKV = new MMKV({
  id: ASSET_SYNC_PERSISTENCE_QUEUE_STORAGE_ID,
});

export const ALL_KNOWN_MMKV_INSTANCES = {
  [MMKV_FILE_NAMES.DEFAULT]: appMMKV,
  [MMKV_FILE_NAMES.KEYCHAIN]: keychainMMKV,
  [MMKV_FILE_NAMES.KEYRING]: keyringMMKV,
  [MMKV_FILE_NAMES.KEYRING_CHECKPOINT]: keyringCheckpointMMKV,
  [MMKV_FILE_NAMES.CHAINS]: chainsMMKV,
  [MMKV_FILE_NAMES.DAYCURVE]: dayCurveMMKV,
  [MMKV_FILE_NAMES.CEXID]: cexIdMMKV,
  [MMKV_FILE_NAMES.BALANCE_24H]: balance24hMMKV,
  [MMKV_FILE_NAMES.TESTNET_BALANCE]: testnetBalanceMMKV,
  [MMKV_FILE_NAMES.WALLETCONNECT]: walletConnectMMKV,
  [MMKV_FILE_NAMES.LENDING_DATA_CACHE]: lendingDataCacheMMKV,
  [ASSET_SYNC_PERSISTENCE_QUEUE_STORAGE_ID]: assetSyncPersistenceQueueMMKV,
} as const;
