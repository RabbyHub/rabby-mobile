describe('core/apis/keychain', () => {
  const setup = async () => {
    jest.resetModules();

    const mockEncrypt = jest.fn(
      async (_salt: string, payload: { password: string }) => {
        return `enc:${payload.password}`;
      },
    );
    const mockDecrypt = jest.fn(async () => ({ password: 'plain-password' }));
    const mockGetGenericPassword = jest.fn(async () => ({
      service: 'com.debank',
      username: 'rabbymobile-user',
      password: 'enc:plain-password',
      storage: 'KeystoreRSAECB',
    }));
    const mockSetGenericPassword = jest.fn(async () => true);
    const mockSafeVerifyPasswordAndUpdateUnlockTime = jest.fn(async () => ({
      success: true,
    }));
    const mockUpdateUnlockTime = jest.fn();

    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('react-native-keychain', () => {
      const RNKeychain = {
        getGenericPassword: mockGetGenericPassword,
        setGenericPassword: mockSetGenericPassword,
        resetGenericPassword: jest.fn(),
        getSupportedBiometryType: jest.fn(),
        ACCESSIBLE: {
          WHEN_UNLOCKED_THIS_DEVICE_ONLY:
            'AccessibleWhenUnlockedThisDeviceOnly',
        },
        ACCESS_CONTROL: {
          BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
          DEVICE_PASSCODE: 'DevicePasscode',
        },
        AUTHENTICATION_TYPE: {
          BIOMETRICS: 'AuthenticationWithBiometrics',
        },
        SECURITY_RULES: {
          AUTOMATIC_UPGRADE: 'automaticUpgradeToMoreSecuredStorage',
        },
      };

      return {
        __esModule: true,
        default: RNKeychain,
        STORAGE_TYPE: {
          RSA: 'KeystoreRSAECB',
        },
      };
    });
    jest.doMock('../services', () => ({
      appEncryptor: {
        encrypt: mockEncrypt,
        decrypt: mockDecrypt,
      },
    }));
    jest.doMock('./lock', () => ({
      safeVerifyPasswordAndUpdateUnlockTime:
        mockSafeVerifyPasswordAndUpdateUnlockTime,
      updateUnlockTime: mockUpdateUnlockTime,
    }));
    jest.doMock('../storage/mmkvInstances', () => ({
      keychainMMKV: {
        getNumber: jest.fn(),
        set: jest.fn(),
      },
    }));
    jest.doMock('../storage/mmkvConstants', () => ({
      KEYCHAIN_MMKV_KEYS: {
        AUTHENTICATION_TYPE: 'AUTHENTICATION_TYPE',
      },
    }));
    jest.doMock('@/utils/i18n', () => ({
      __esModule: true,
      default: {
        t: (key: string) => key,
      },
    }));

    let module!: typeof import('./keychain');
    jest.isolateModules(() => {
      module = require('./keychain');
    });
    module.makeSecureKeyChainInstance({ salt: 'salt' });

    return {
      module,
      mockGetGenericPassword,
      mockSetGenericPassword,
      mockSafeVerifyPasswordAndUpdateUnlockTime,
      mockUpdateUnlockTime,
    };
  };

  it('keeps automatic-upgrade reads on Android for legacy biometrics entries', async () => {
    const {
      module,
      mockGetGenericPassword,
      mockSafeVerifyPasswordAndUpdateUnlockTime,
    } = await setup();

    const result = await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.VERIFY,
    });

    expect(mockGetGenericPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'com.debank',
        rules: 'automaticUpgradeToMoreSecuredStorage',
      }),
    );
    expect(mockSafeVerifyPasswordAndUpdateUnlockTime).toHaveBeenCalledWith(
      'plain-password',
    );
    expect(result?.actionSuccess).toBe(true);
  });

  it('keeps Android biometric writes on RSA storage', async () => {
    const { module, mockSetGenericPassword } = await setup();

    await module.setGenericPassword(
      'plain-password',
      module.KEYCHAIN_AUTH_TYPES.BIOMETRICS,
    );

    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'rabbymobile-user',
      'enc:plain-password',
      expect.objectContaining({
        service: 'com.debank',
        storage: 'KeystoreRSAECB',
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
        accessControl: 'BiometryCurrentSet',
      }),
    );
  });
});
