jest.mock('@/constant', () => ({
  isNonPublicProductionEnv: false,
}));

jest.mock('@/constant/autoLock', () => ({
  DEFAULT_AUTO_LOCK_MINUTES: 5,
}));

jest.mock('@/core/apis/autoLock', () => ({
  getPersistedAutoLockTimes: jest.fn(() => ({ minutes: 5 })),
  coerceAutoLockTimeout: jest.fn(() => ({ minutes: 5 })),
  refreshAutolockTimeout: jest.fn(),
}));

jest.mock('@/core/apis/keychainCommon', () => ({
  KEYCHAIN_STORAGE_TYPES: {
    RSA: 'KeystoreRSAECB',
    AES: 'KeystoreAESCBC',
    AES_GCM: 'KeystoreAESGCM',
    AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth',
    KC: 'keychain',
  },
  DEFAULT_KEYCHAIN_STORAGE_TYPE: 'KeystoreAESGCM_NoAuth',
  coerceKeychainStorageType: jest.fn(
    (storage?: string) => storage || 'KeystoreAESGCM_NoAuth',
  ),
}));

jest.mock('@/core/services', () => ({
  preferenceService: {
    setPreference: jest.fn(),
  },
}));

jest.mock('@/core/storage/mmkv', () => ({
  zustandByMMKV: jest.fn((_key: string, initialState: object) => {
    let state = initialState;
    const store: any = (selector?: any) => (selector ? selector(state) : state);

    store.getState = () => state;
    store.setState = updater => {
      const nextState =
        typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...nextState };
    };

    return store;
  }),
}));

jest.mock('@/core/utils/device', () => ({
  __esModule: true,
  default: {
    isIOS: jest.fn(() => false),
  },
}));

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.fn((initializer: () => object) => {
    let state = initializer();
    const store: any = (selector?: any) => (selector ? selector(state) : state);

    store.getState = () => state;
    store.setState = updater => {
      const nextState =
        typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...nextState };
    };

    return store;
  }),
}));

jest.mock('@/core/utils/store', () => ({
  resolveValFromUpdater: jest.fn((prev: unknown, updater: unknown) => ({
    newVal: typeof updater === 'function' ? updater(prev) : updater,
  })),
  runIIFEFunc: jest.fn((fn: () => void) => fn()),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: jest.fn((selector: unknown) => selector),
}));

describe('hooks/appSettings keychain defaults', () => {
  it('keeps v9 as the production current keychain version', () => {
    jest.isolateModules(() => {
      const {
        DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD,
        getCurrentKeychainVersion,
        setCurrentKeychainVersion,
      } = require('./appSettings') as typeof import('./appSettings');

      expect(DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD).toBe(
        'debugCurrentKeychainVersion20260602',
      );
      expect(getCurrentKeychainVersion()).toBe('9.0.0');
      expect(setCurrentKeychainVersion('10.0.0')).toBe('9.0.0');
      expect(getCurrentKeychainVersion()).toBe('9.0.0');
    });
  });
});
