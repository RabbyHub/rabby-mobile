describe('core/apis/keychainV8_2_0', () => {
  const setup = async (options?: {
    storage?: string;
    authType?: number;
    salt?: string;
    trustedVaultKeyString?: string | null;
  }) => {
    jest.resetModules();
    const {
      storage = 'KeystoreRSAECB',
      authType = 1,
      salt = 'salt',
      trustedVaultKeyString = null,
    } = options || {};

    const mockEncrypt = jest.fn(
      async (_salt: string, payload: { password: string }) => {
        return `enc:${payload.password}`;
      },
    );
    const mockDecrypt = jest.fn(async () => ({ password: 'plain-password' }));
    const mockGetGenericPassword = jest.fn(
      async (keychainOptions?: { service?: string }) => {
        if (keychainOptions?.service === 'com.debank.trusted-vault-key') {
          if (!trustedVaultKeyString) {
            return false;
          }

          return {
            service: 'com.debank.trusted-vault-key',
            username: 'rabbymobile-vault-key',
            password: trustedVaultKeyString,
            storage,
          };
        }

        return {
          service: 'com.debank',
          username: 'rabbymobile-user',
          password: 'enc:plain-password',
          storage,
        };
      },
    );
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
      candidateCipherStorageNames: ['KeystoreRSAECB', 'FacebookConceal'],
      cipherStorageResolutionStrategy: 'missing-marker-rsa-size-heuristic',
      usernameByteSize: 32,
      passwordByteSize: 64,
      keystoreAlias: 'com.debank',
      hasKeystoreAlias: true,
      keystoreKeyAlgorithm: 'RSA',
      keystoreSecurityLevel: 'SECURE_HARDWARE',
      keystoreInsideSecureHardware: true,
      keystoreUserAuthenticationRequired: true,
      keystoreUserAuthenticationValidityDurationSeconds: 60,
      keystoreUserAuthenticationType: 2,
      keystoreBlockModes: 'ECB',
      keystorePurposes: 3,
      keystoreIsCompatibleWithCurrentCipher: true,
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
        RNRabbyKeychainManager: {
          debugGetGenericPasswordStateForOptions:
            mockDebugGetGenericPasswordStateForOptions,
          debugRemoveCipherStorageMarkerForOptions:
            mockDebugRemoveCipherStorageMarkerForOptions,
        },
      },
    }));
    jest.doMock('@rabby-wallet/react-native-keychain', () => {
      const RNKeychain = {
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
    jest.doMock('./androidBiometricsRegression', () => ({
      getAndroidBiometricSecurityLevelOptions: jest.fn(() => ({
        androidBiometricSecurityLevel: 'strong',
      })),
    }));

    let module!: typeof import('./keychainV8_2_0');
    jest.isolateModules(() => {
      module = require('./keychainV8_2_0');
    });
    module.makeSecureKeyChainInstance({ salt });

    return {
      module,
      mockEncrypt,
      mockDecrypt,
      mockGetGenericPassword,
      mockSetGenericPassword,
      mockResetGenericPassword,
      mockDebugGetGenericPasswordStateForOptions,
      mockDebugRemoveCipherStorageMarkerForOptions,
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
    expect(onPlainPassword).toHaveBeenCalledWith(
      'plain-password',
      expect.objectContaining({ password: 'plain-password' }),
    );
    expect(mockUpdateUnlockTime).toHaveBeenCalled();
    expect(mockEncrypt).toHaveBeenCalledWith(currentRabbitCode, {
      androidKeychainAuthProfile: 'biometric-strong-v1',
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
        androidAllowKeyStoreRecovery: false,
      }),
    );
  });

  it('reports broken Android biometrics entries without resetting keychain data', async () => {
    const {
      module,
      mockGetGenericPassword,
      mockResetGenericPassword,
      mockDebugGetGenericPasswordStateForOptions,
    } = await setup();

    mockGetGenericPassword.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'RSA decrypt failed on both current and legacy paths. current=IllegalBlockSizeException:null, legacy=IOException:javax.crypto.IllegalBlockSizeException',
        ),
        {
          code: 'E_CRYPTO_FAILED',
        },
      ),
    );
    mockDebugGetGenericPasswordStateForOptions.mockResolvedValueOnce({
      service: 'com.debank',
      hasEntry: true,
      hasUsername: true,
      hasPassword: true,
      hasCipherStorageMarker: true,
      isCipherStorageMarkerMissing: false,
      storedCipherStorageName: 'KeystoreRSAECB',
      resolvedCipherStorageName: 'KeystoreRSAECB',
      candidateCipherStorageNames: ['KeystoreRSAECB'],
      cipherStorageResolutionStrategy: 'stored-marker',
      usernameByteSize: 256,
      passwordByteSize: 256,
      keystoreAlias: 'com.debank',
      hasKeystoreAlias: true,
      keystoreKeyAlgorithm: 'RSA',
      keystoreSecurityLevel: 'SECURE_HARDWARE',
      keystoreInsideSecureHardware: true,
      keystoreUserAuthenticationRequired: true,
      keystoreUserAuthenticationValidityDurationSeconds: 60,
      keystoreUserAuthenticationType: 2,
      keystoreBlockModes: 'ECB',
      keystorePurposes: 3,
      keystoreIsCompatibleWithCurrentCipher: true,
      keystoreDebugErrorMessage: null,
    });

    await expect(
      module.requestGenericPassword({
        purpose: module.RequestGenericPurpose.DECRYPT_PWD,
      }),
    ).rejects.toMatchObject({
      code: module.KEYCHAIN_ERROR_CODES.BROKEN_BIOMETRICS_ENTRY,
    });
    expect(mockResetGenericPassword).not.toHaveBeenCalled();
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

  it('reports the supported Android storage types from the debug config', async () => {
    const { module } = await setup();

    const result = await module.getSupportedStorageTypes();

    expect(result).toEqual([
      module.KEYCHAIN_STORAGE_TYPES.RSA,
      module.KEYCHAIN_STORAGE_TYPES.AES,
    ]);
  });

  it('writes mock legacy Android biometrics data with RSA storage and removes the cipher marker', async () => {
    const {
      module,
      mockSetGenericPassword,
      mockDebugRemoveCipherStorageMarkerForOptions,
    } = await setup();

    await module.debugWriteMockLegacyBiometricsEntry('legacy-password');

    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'rabbymobile-user',
      'enc:legacy-password',
      expect.objectContaining({
        service: 'com.debank',
        storage: 'KeystoreRSAECB',
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
        accessControl: 'BiometryCurrentSet',
      }),
    );
    expect(mockDebugRemoveCipherStorageMarkerForOptions).toHaveBeenCalledWith({
      service: 'com.debank',
    });
  });

  it('removes the current cipher marker without rewriting the biometrics entry', async () => {
    const {
      module,
      mockSetGenericPassword,
      mockDebugRemoveCipherStorageMarkerForOptions,
    } = await setup();

    await module.debugRemoveCurrentCipherStorageMarker();

    expect(mockSetGenericPassword).not.toHaveBeenCalled();
    expect(mockDebugRemoveCipherStorageMarkerForOptions).toHaveBeenCalledWith({
      service: 'com.debank',
    });
  });

  it('decrypts a stored keychain payload with the current security chain instance', async () => {
    const { module, mockDecrypt } = await setup();

    const result = await module.debugDecryptStoredPasswordPayload(
      '{"cipher":"abc","iv":"def","salt":"ghi"}',
    );

    expect(mockDecrypt).toHaveBeenCalledWith(
      'salt',
      '{"cipher":"abc","iv":"def","salt":"ghi"}',
    );
    expect(result).toEqual({
      password: 'plain-password',
    });
  });

  it('exposes iOS keychain debug state from the fork native attributes path', async () => {
    jest.resetModules();

    const mockEncrypt = jest.fn(
      async (_salt: string, payload: { password: string }) => {
        return `enc:${payload.password}`;
      },
    );
    const mockDecrypt = jest.fn(async () => ({ password: 'plain-password' }));
    const mockDebugGetGenericPasswordStateForOptions = jest.fn(async () => ({
      storageName: 'keychain',
      hasEntry: true,
      hasUsername: true,
      hasPassword: true,
      account: 'rabbymobile-user',
      accessGroup: null,
      accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
      synchronizable: false,
      hasAccessControl: true,
      accessControlDescription: '<SecAccessControlRef>',
      accessControlConstraints: '{od={cpo=1; pkofn=1;}}',
      itemClass: 'genericPassword',
      authenticationUIBlocked: false,
      nativeDebugErrorMessage: null,
    }));

    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
      NativeModules: {
        RNRabbyKeychainManager: {
          debugGetGenericPasswordStateForOptions:
            mockDebugGetGenericPasswordStateForOptions,
        },
      },
    }));
    jest.doMock('@rabby-wallet/react-native-keychain', () => {
      const RNKeychain = {
        getGenericPassword: jest.fn(),
        setGenericPassword: jest.fn(async () => true),
        resetGenericPassword: jest.fn(async () => true),
        getSupportedBiometryType: jest.fn(async () => 'FaceID'),
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
      safeVerifyPasswordAndUpdateUnlockTime: jest.fn(async () => ({
        success: true,
      })),
      updateUnlockTime: jest.fn(),
      clearCustomPassword: jest.fn(async () => ({ error: null })),
    }));
    jest.doMock('../storage/mmkvInstances', () => ({
      keychainMMKV: {
        getNumber: jest.fn(() => 1),
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

    let module!: typeof import('./keychainV8_2_0');
    jest.isolateModules(() => {
      module = require('./keychainV8_2_0');
    });
    module.makeSecureKeyChainInstance({ salt: 'salt' });

    const result = await module.getKeychainDebugState('com.debank');

    expect(mockDebugGetGenericPasswordStateForOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'com.debank',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        platform: 'ios',
        service: 'com.debank',
        storageName: 'keychain',
        account: 'rabbymobile-user',
        hasAccessControl: true,
        itemClass: 'genericPassword',
        debugSupported: true,
        supportedBiometryType: 'FaceID',
      }),
    );
  });
});
