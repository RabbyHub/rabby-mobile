export enum MMKV_FILE_NAMES {
  DEFAULT = 'mmkv.default',
  KEYCHAIN = 'mmkv.keychain',
  KEYRING = 'mmkv.keyring',
  CHAINS = 'mmkv.chains',
  DAYCURVE = 'mmkv.24hCurve',
  CEXID = 'mmkv.cexid',
  BALANCE_24H = 'mmkv.balance24h',
  TESTNET_BALANCE = 'mmkv.testnetBalance',

  LENDING_DATA_CACHE = 'mmkv.lendingDataCache',
}

export const APP_MMKV_KEYS = {
  LEGACY_KEYRING_STATE: 'keyringState',
  MINI_SIGN_CUSTOM_GAS: 'miniSignCustomGas',
  NOTIFICATION: 'notification',
} as const;

export const KEYCHAIN_MMKV_KEYS = {
  AUTHENTICATION_TYPE: 'KEYCHAIN_AUTH_TYPES',
  BIOMETRIC_FAILURE_DIAGNOSTIC: 'BIOMETRIC_FAILURE_DIAGNOSTIC',
} as const;

export const APP_MMKV_WEAK_KEYS = {
  STORE_MIGRATIONS: '@StoreMigrations',
  SERVICE_MIGRATIONS: '@ServiceMigrations',
  SCENE_ACCOUNTS_LEGACY: '@SceneAccounts',
  SCENE_ACCOUNTS: '@SceneAccounts202512',
  RATE_GUIDE_LAST_EXPOSURE: '@RateGuideLastExposure',
  SCREENSHOT_FEEDBACK: '@screenshotFeedback',
  HAS_TIPED_USER_ENABLE_BIOMETRICS: '@hasTipedUserEnableBiometrics',
  LENDING_MARKET: '@lendingMarket',
  FAILED_UNLOCK: '@failed_unlock',
  HOME_TOP10_ADDRESSES: '@homeTop10Addresses',
} as const;
