describe('core/apis/keychainV9_0_0', () => {
  const setup = async (options?: {
    storage?: string;
    authType?: number;
    salt?: string;
  }) => {
    jest.resetModules();
    const {
      storage = 'KeystoreRSAECB',
      authType = 1,
      salt = 'salt',
    } = options || {};

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
      storage,
    }));
    const mockSetGenericPassword = jest.fn(async () => true);
    const mockResetGenericPassword = jest.fn(async () => true);
    const mockDebugGetGenericPasswordStateForOptions = jest.fn(async () => ({
      service: 'com.debank',
      hasEntry: true,
      hasUsername: true,
      hasPassword: true,
      hasCipherStorageMarker: false,
      isCipherStorageMarkerMissing: true,
      storedCipherStorageName: null,
      resolvedCipherStorageName: 'KeystoreRSAECB',
      candidateCipherStorageNames: ['KeystoreRSAECB'],
      cipherStorageResolutionStrategy: 'missing-marker/default-rsa',
      usernameByteSize: 32,
      passwordByteSize: 64,
      keystoreAlias: 'com.debank',
      hasKeystoreAlias: true,
      keystoreKeyAlgorithm: 'RSA',
      keystoreSecurityLevel: 'SECURE_HARDWARE',
      keystoreInsideSecureHardware: true,
      keystoreUserAuthenticationRequired: true,
      keystoreUserAuthenticationValidityDurationSeconds: 1,
      keystoreUserAuthenticationType: 2,
      keystoreBlockModes: 'ECB',
      keystorePurposes: 3,
      keystoreIsCompatibleWithCurrentCipher: true,
      keystorePublicKeySha256: 'debug-public-key',
      keystoreDebugErrorMessage: null,
    }));
    const mockDebugRemoveCipherStorageMarkerForOptions = jest.fn(
      async () => true,
    );
    const mockSafeVerifyPasswordAndUpdateUnlockTime = jest.fn(async () => ({
      success: true,
    }));
    const mockUpdateUnlockTime = jest.fn();

    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      NativeModules: {
        RNRabbyKeychainV9Manager: {
          debugGetGenericPasswordStateForOptions:
            mockDebugGetGenericPasswordStateForOptions,
          debugRemoveCipherStorageMarkerForOptions:
            mockDebugRemoveCipherStorageMarkerForOptions,
        },
      },
    }));
    jest.doMock('@rabby-wallet/react-native-keychain-9', () => {
      const OfficialKeychain = {
        getGenericPassword: mockGetGenericPassword,
        setGenericPassword: mockSetGenericPassword,
        resetGenericPassword: mockResetGenericPassword,
        getSupportedBiometryType: jest.fn(async () => 'Fingerprint'),
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
        default: OfficialKeychain,
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
      clearCustomPassword: jest.fn(async () => ({ error: null })),
    }));
    jest.doMock('../storage/mmkvInstances', () => ({
      keychainMMKV: {
        getNumber: jest.fn(() => authType),
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
    jest.doMock('@/utils/logger', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
      },
    }));

    let module!: typeof import('./keychainV9_0_0');
    jest.isolateModules(() => {
      module = require('./keychainV9_0_0');
    });
    module.makeSecureKeyChainInstance({ salt });

    return {
      module,
      mockEncrypt,
      mockDecrypt,
      mockGetGenericPassword,
      mockSetGenericPassword,
      mockDebugGetGenericPasswordStateForOptions,
      mockSafeVerifyPasswordAndUpdateUnlockTime,
      mockUpdateUnlockTime,
    };
  };

  it('falls back to the default rabbit code and silently rewrites stored credentials', async () => {
    const currentRabbitCode = 'CURRENT_RABBIT_CODE';
    const {
      module,
      mockEncrypt,
      mockDecrypt,
      mockSetGenericPassword,
      mockUpdateUnlockTime,
    } = await setup({
      salt: currentRabbitCode,
      storage: 'keychain',
    });

    mockDecrypt.mockImplementation(async (salt: string) => {
      if (salt === currentRabbitCode) {
        throw new Error('decrypt failed with current rabbit code');
      }

      if (salt === 'RABBY_MOBILE_CODE_DEV') {
        return { password: 'plain-password' };
      }

      throw new Error(`unexpected rabbit code: ${salt}`);
    });

    const onPlainPassword = jest.fn();
    const result = await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.DECRYPT_PWD,
      onPlainPassword,
    });

    expect(mockDecrypt.mock.calls.map(call => call[0])).toEqual([
      currentRabbitCode,
      'RABBY_MOBILE_CODE_DEV',
    ]);
    expect(onPlainPassword).toHaveBeenCalledWith('plain-password');
    expect(mockUpdateUnlockTime).toHaveBeenCalled();
    expect(mockEncrypt).toHaveBeenCalledWith(currentRabbitCode, {
      password: 'plain-password',
    });
    expect(mockSetGenericPassword).toHaveBeenCalledTimes(1);
    expect(result?.actionSuccess).toBe(true);
  });

  it('keeps automatic-upgrade reads on Android for legacy biometrics entries', async () => {
    const {
      module,
      mockGetGenericPassword,
      mockSetGenericPassword,
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
    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'rabbymobile-user',
      'enc:plain-password',
      expect.objectContaining({
        service: 'com.debank',
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
        accessControl: 'BiometryCurrentSet',
      }),
    );
    expect(mockSetGenericPassword.mock.calls[0]?.[2]).not.toHaveProperty(
      'storage',
    );
    expect(result?.actionSuccess).toBe(true);
  });

  it('rewrites Android biometric entries with the library default secure storage', async () => {
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
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
        accessControl: 'BiometryCurrentSet',
      }),
    );
    expect(mockSetGenericPassword.mock.calls[0]?.[2]).not.toHaveProperty(
      'storage',
    );
  });

  it('passes an explicit storage when rewriting Android biometric entries', async () => {
    const { module, mockSetGenericPassword } = await setup();

    await module.setGenericPassword(
      'plain-password',
      module.KEYCHAIN_AUTH_TYPES.BIOMETRICS,
      {
        storage: module.KEYCHAIN_STORAGE_TYPES.AES,
      },
    );

    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'rabbymobile-user',
      'enc:plain-password',
      expect.objectContaining({
        service: 'com.debank',
        storage: 'KeystoreAESCBC',
      }),
    );
  });

  it('does not rewrite Android biometrics storage when the entry is already upgraded', async () => {
    const { module, mockSetGenericPassword } = await setup({
      storage: 'KeystoreAESGCM',
    });

    await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.VERIFY,
    });

    expect(mockSetGenericPassword).not.toHaveBeenCalled();
  });

  it('passes the Android authenticated-session reuse option through business reads when requested', async () => {
    const { module, mockGetGenericPassword } = await setup();

    await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.DECRYPT_PWD,
      androidAuthPromptPolicy:
        module.ANDROID_AUTH_PROMPT_POLICIES.ALLOW_AUTHENTICATED_SESSION_REUSE,
    });

    expect(mockGetGenericPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'com.debank',
        androidAllowAuthenticatedSessionReuse: true,
      }),
    );
  });

  it('reports the supported Android storage types from the debug config', async () => {
    const { module } = await setup();

    const result = await module.getSupportedStorageTypes();

    expect(result).toEqual([
      module.KEYCHAIN_STORAGE_TYPES.RSA,
      module.KEYCHAIN_STORAGE_TYPES.AES,
    ]);
  });

  it('exposes Android keychain debug state from the native storage layer', async () => {
    const { module, mockDebugGetGenericPasswordStateForOptions } = await setup({
      authType: 0,
    });

    const result = await module.getKeychainDebugState();

    expect(mockDebugGetGenericPasswordStateForOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'com.debank',
        rules: 'automaticUpgradeToMoreSecuredStorage',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        service: 'com.debank',
        resolvedCipherStorageName: 'KeystoreRSAECB',
        isCipherStorageMarkerMissing: true,
        authenticationTypeLabel: 'APPLICATION_PASSWORD',
      }),
    );
  });
});
