import { makeSecureKeyChainInstance } from './keychain';

// Mock MMKV file names
jest.mock('../utils/appFS', () => ({
  MMKV_FILE_NAMES: {
    KEYCHAIN: 'mock-keychain-file',
  },
}));

// Mock encryptor
jest.mock('../services', () => ({
  appEncryptor: {
    encrypt: jest.fn(async (salt, data) => `encrypted-${data.password}`),
    decrypt: jest.fn(async (salt, encrypted) => ({
      password: encrypted.replace('encrypted-', ''),
    })),
  },
}));

// Mock RNKeychain
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => ({
    username: 'user',
    password: 'encrypted-123',
  })),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
  AUTHENTICATION_TYPE: { BIOMETRICS: 'BIOMETRICS' },
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'BIOMETRY_CURRENT_SET',
    DEVICE_PASSCODE: 'DEVICE_PASSCODE',
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  },
}));

// Mock apisLock
jest.mock('./lock', () => ({
  safeVerifyPasswordAndUpdateUnlockTime: jest.fn(async (pwd: string) => ({
    success: true,
  })),
  updateUnlockTime: jest.fn(),
  clearCustomPassword: jest.fn(async (pwd: string) => ({ error: null })),
}));

describe('makeSecureKeyChainInstance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a singleton instance', () => {
    const instance1 = makeSecureKeyChainInstance({ salt: 'salt1' });
    const instance2 = makeSecureKeyChainInstance({ salt: 'salt2' });
    expect(instance1).toBe(instance2);
  });

  it('encrypts and decrypts password via appEncryptor', async () => {
    const instance = makeSecureKeyChainInstance({ salt: 'salt1' });

    const encrypted = await instance.encryptPassword('123456');
    expect(encrypted).toBe('encrypted-123456');

    const decrypted = await instance.decryptPassword('encrypted-123456');
    expect(decrypted.password).toBe('123456');
  });
});

describe('waitInstance behavior (internal use)', () => {
  beforeEach(() => {
    jest.resetModules(); // clear module cache for SKCls singleton
    jest.clearAllMocks();
  });

  it('should wait for SKCls to be ready before setting generic password', async () => {
    const {
      setGenericPassword,
      makeSecureKeyChainInstance,
    } = require('./keychain');

    makeSecureKeyChainInstance({ salt: 'mysalt' });
    await setGenericPassword('123456');

    // The mock encryptor should have been called, meaning waitInstance resolved
    const { appEncryptor } = require('../services');
    expect(appEncryptor.encrypt).toHaveBeenCalledWith('mysalt', {
      password: '123456',
    });
  });

  it('should allow requestGenericPassword to wait for instance', async () => {
    const {
      requestGenericPassword,
      makeSecureKeyChainInstance,
      RequestGenericPurpose,
    } = require('./keychain');

    makeSecureKeyChainInstance({ salt: 'mysalt' });

    const result = await requestGenericPassword({
      purpose: RequestGenericPurpose.VERIFY,
    });

    expect(result?.actionSuccess).toBe(true);
  });
});
