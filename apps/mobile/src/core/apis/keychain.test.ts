describe('core/apis/keychain current facade', () => {
  const setup = async (version: '8.2.0-fork' | '9.0.0' | '10.0.0') => {
    jest.resetModules();

    const mockV8RequestGenericPassword = jest.fn(async () => 'v8-request');
    const mockV9RequestGenericPassword = jest.fn(async () => 'v9-request');
    const mockV10RequestGenericPassword = jest.fn(async () => 'v10-request');
    const mockV8SetGenericPassword = jest.fn(async () => undefined);
    const mockV9SetGenericPassword = jest.fn(async () => undefined);
    const mockV10SetGenericPassword = jest.fn(async () => undefined);
    const mockV8ResetGenericPassword = jest.fn(async () => true);
    const mockV9ResetGenericPassword = jest.fn(async () => true);
    const mockV10ResetGenericPassword = jest.fn(async () => true);
    const mockV8GetKeychainDebugState = jest.fn(async () => ({
      sourceLabel: 'v8-label',
      hasEntry: true,
      storedUsernameBase64: 'v8-username',
      storedPasswordBase64: 'v8-password',
    }));
    const mockV9GetKeychainDebugState = jest.fn(async () => ({
      sourceLabel: 'v9-label',
      hasEntry: true,
      storedUsernameBase64: 'v9-username',
      storedPasswordBase64: 'v9-password',
    }));
    const mockV10GetKeychainDebugState = jest.fn(async () => ({
      sourceLabel: 'v10-label',
      hasEntry: true,
    }));
    const mockKeychainMMKVSet = jest.fn();
    const mockLoggerInfo = jest.fn();
    const mockLoggerWarn = jest.fn();

    jest.doMock('@/hooks/appSettings', () => ({
      getCurrentKeychainVersion: jest.fn(() => version),
    }));
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('@/utils/logger', () => ({
      logger: {
        info: mockLoggerInfo,
        warn: mockLoggerWarn,
      },
    }));
    jest.doMock('../storage/mmkvInstances', () => ({
      keychainMMKV: {
        set: mockKeychainMMKVSet,
      },
    }));
    jest.doMock('../storage/mmkvConstants', () => ({
      KEYCHAIN_MMKV_KEYS: {
        BIOMETRIC_FAILURE_DIAGNOSTIC: 'BIOMETRIC_FAILURE_DIAGNOSTIC',
      },
    }));
    jest.doMock('./keychainCommon', () => ({
      KEYCHAIN_AUTH_TYPES: {
        APPLICATION_PASSWORD: 0,
        BIOMETRICS: 1,
        PASSCODE: 2,
        REMEMBER_ME: 3,
      },
      KEYCHAIN_DEFAULT_SERVICE: 'com.debank',
      KEYCHAIN_ERROR_CODES: {
        NIL_KEYCHAIN_OBJECT: 'NIL_KEYCHAIN_OBJECT',
        BROKEN_BIOMETRICS_ENTRY: 'BROKEN_BIOMETRICS_ENTRY',
      },
      RequestGenericPurpose: {
        VERIFY: 1,
        DECRYPT_PWD: 11,
      },
      getAuthenticationType: jest.fn(() => 1),
      getAuthenticationTypeLabel: jest.fn(() => 'BIOMETRICS'),
      isAuthenticatedByBiometrics: jest.fn(() => true),
      isBrokenBiometricsEntryError: jest.fn(() => false),
      makeKeyChainError: jest.fn(),
      parseKeychainError: jest.fn(() => ({ isCancelledByUser: false })),
    }));
    jest.doMock('./keychainV8_2_0', () => ({
      KEYCHAIN_SOURCE_LABEL: 'v8-label',
      makeSecureKeyChainInstance: jest.fn(() => 'v8-instance'),
      requestGenericPassword: mockV8RequestGenericPassword,
      getSupportedBiometryType: jest.fn(async () => 'Fingerprint'),
      getKeychainDebugState: mockV8GetKeychainDebugState,
      debugRemoveCurrentCipherStorageMarker: jest.fn(async () => true),
      debugWriteMockLegacyBiometricsEntry: jest.fn(async () => true),
      debugDecryptStoredPasswordPayload: jest.fn(async () => ({
        password: 'v8',
      })),
      setGenericPassword: mockV8SetGenericPassword,
      cacheTrustedVaultKeyString: jest.fn(async () => undefined),
      resetGenericPassword: mockV8ResetGenericPassword,
      clearApplicationPassword: jest.fn(async () => ({
        clearCustomPasswordError: null,
        clearGenericPasswordSuccess: true,
      })),
    }));
    jest.doMock('./keychainV9_0_0', () => ({
      KEYCHAIN_SOURCE_LABEL: 'v9-label',
      makeSecureKeyChainInstance: jest.fn(() => 'v9-instance'),
      requestGenericPassword: mockV9RequestGenericPassword,
      getSupportedBiometryType: jest.fn(async () => 'Fingerprint'),
      getKeychainDebugState: mockV9GetKeychainDebugState,
      debugRemoveCurrentCipherStorageMarker: jest.fn(async () => true),
      debugWriteMockLegacyBiometricsEntry: jest.fn(async () => true),
      debugDecryptStoredPasswordPayload: jest.fn(async () => ({
        password: 'v9',
      })),
      setGenericPassword: mockV9SetGenericPassword,
      cacheTrustedVaultKeyString: jest.fn(async () => undefined),
      resetGenericPassword: mockV9ResetGenericPassword,
      clearApplicationPassword: jest.fn(async () => ({
        clearCustomPasswordError: null,
        clearGenericPasswordSuccess: true,
      })),
    }));
    jest.doMock('./keychainV10_0_0', () => ({
      KEYCHAIN_SOURCE_LABEL: 'v10-label',
      makeSecureKeyChainInstance: jest.fn(() => 'v10-instance'),
      requestGenericPassword: mockV10RequestGenericPassword,
      getSupportedBiometryType: jest.fn(async () => 'Fingerprint'),
      getKeychainDebugState: mockV10GetKeychainDebugState,
      debugRemoveCurrentCipherStorageMarker: jest.fn(async () => true),
      debugWriteMockLegacyBiometricsEntry: jest.fn(async () => true),
      debugDecryptStoredPasswordPayload: jest.fn(async () => ({
        password: 'v10',
      })),
      setGenericPassword: mockV10SetGenericPassword,
      cacheTrustedVaultKeyString: jest.fn(async () => undefined),
      resetGenericPassword: mockV10ResetGenericPassword,
      clearApplicationPassword: jest.fn(async () => ({
        clearCustomPasswordError: null,
        clearGenericPasswordSuccess: true,
      })),
    }));

    let module!: typeof import('./keychain');
    jest.isolateModules(() => {
      module = require('./keychain');
    });

    return {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV10RequestGenericPassword,
      mockV8SetGenericPassword,
      mockV9SetGenericPassword,
      mockV10SetGenericPassword,
      mockV8ResetGenericPassword,
      mockV9ResetGenericPassword,
      mockV10ResetGenericPassword,
      mockV8GetKeychainDebugState,
      mockV9GetKeychainDebugState,
      mockV10GetKeychainDebugState,
      mockKeychainMMKVSet,
      mockLoggerInfo,
      mockLoggerWarn,
    };
  };

  it('routes facade calls to the configured v8 implementation', async () => {
    const {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV10RequestGenericPassword,
      mockV8ResetGenericPassword,
      mockV9ResetGenericPassword,
      mockV10ResetGenericPassword,
    } = await setup('8.2.0-fork');

    const requestResult = await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.DECRYPT_PWD,
    });
    const resetResult = await module.resetGenericPassword();

    expect(requestResult).toBe('v8-request');
    expect(resetResult).toBe(true);
    expect(module.getCurrentKeychainSourceLabel()).toBe('v8-label');
    expect(mockV8RequestGenericPassword).toHaveBeenCalled();
    expect(mockV9RequestGenericPassword).not.toHaveBeenCalled();
    expect(mockV10RequestGenericPassword).not.toHaveBeenCalled();
    expect(mockV8ResetGenericPassword).toHaveBeenCalled();
    expect(mockV9ResetGenericPassword).not.toHaveBeenCalled();
    expect(mockV10ResetGenericPassword).not.toHaveBeenCalled();
  });

  it('routes facade calls to the configured v9 implementation', async () => {
    const {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV10RequestGenericPassword,
      mockV8ResetGenericPassword,
      mockV9ResetGenericPassword,
      mockV10ResetGenericPassword,
    } = await setup('9.0.0');

    const requestResult = await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.DECRYPT_PWD,
    });
    const resetResult = await module.resetGenericPassword();

    expect(requestResult).toBe('v9-request');
    expect(resetResult).toBe(true);
    expect(module.getCurrentKeychainSourceLabel()).toBe('v9-label');
    expect(mockV8RequestGenericPassword).not.toHaveBeenCalled();
    expect(mockV9RequestGenericPassword).toHaveBeenCalled();
    expect(mockV10RequestGenericPassword).not.toHaveBeenCalled();
    expect(mockV8ResetGenericPassword).not.toHaveBeenCalled();
    expect(mockV9ResetGenericPassword).toHaveBeenCalled();
    expect(mockV10ResetGenericPassword).not.toHaveBeenCalled();
  });

  it('routes facade calls to the configured v10 implementation', async () => {
    const {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV10RequestGenericPassword,
      mockV8ResetGenericPassword,
      mockV9ResetGenericPassword,
      mockV10ResetGenericPassword,
    } = await setup('10.0.0');

    const requestResult = await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.DECRYPT_PWD,
    });
    const resetResult = await module.resetGenericPassword();

    expect(requestResult).toBe('v10-request');
    expect(resetResult).toBe(true);
    expect(module.getCurrentKeychainSourceLabel()).toBe('v10-label');
    expect(mockV8RequestGenericPassword).not.toHaveBeenCalled();
    expect(mockV9RequestGenericPassword).not.toHaveBeenCalled();
    expect(mockV10RequestGenericPassword).toHaveBeenCalled();
    expect(mockV8ResetGenericPassword).not.toHaveBeenCalled();
    expect(mockV9ResetGenericPassword).not.toHaveBeenCalled();
    expect(mockV10ResetGenericPassword).toHaveBeenCalled();
  });

  it('repairs the current Android biometric keychain after password unlock', async () => {
    const { module, mockV9SetGenericPassword, mockLoggerInfo } = await setup(
      '9.0.0',
    );

    const result = await module.repairBiometricsAfterPasswordUnlock(
      'plain-password',
      { reason: 'test' },
    );

    expect(mockV9SetGenericPassword).toHaveBeenCalledWith(
      'plain-password',
      module.KEYCHAIN_AUTH_TYPES.BIOMETRICS,
    );
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      '[keychain] repaired Android biometrics after password unlock',
      expect.objectContaining({
        currentVersion: '9.0.0',
        sourceLabel: 'v9-label',
        reason: 'test',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        repaired: true,
        skipped: false,
        currentVersion: '9.0.0',
      }),
    );
  });

  it('records Android biometric diagnostics when the current request fails', async () => {
    const {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV8GetKeychainDebugState,
      mockV9GetKeychainDebugState,
      mockKeychainMMKVSet,
      mockLoggerWarn,
    } = await setup('9.0.0');
    const requestError = Object.assign(new Error('native decrypt failed'), {
      code: 'E_CRYPTO_FAILED',
    });
    mockV9RequestGenericPassword.mockRejectedValueOnce(requestError);
    mockV8RequestGenericPassword.mockRejectedValueOnce(
      new Error('legacy fallback failed'),
    );

    await expect(
      module.requestGenericPassword({
        purpose: module.RequestGenericPurpose.DECRYPT_PWD,
        shouldAttachTrustedVaultKeyString: false,
      }),
    ).rejects.toBe(requestError);

    expect(mockV8GetKeychainDebugState).toHaveBeenCalled();
    expect(mockV9GetKeychainDebugState).toHaveBeenCalled();
    expect(mockKeychainMMKVSet).toHaveBeenCalledWith(
      'BIOMETRIC_FAILURE_DIAGNOSTIC',
      expect.any(String),
    );
    const diagnostic = JSON.parse(mockKeychainMMKVSet.mock.calls[0][1]);
    expect(diagnostic).toEqual(
      expect.objectContaining({
        stage: 'requestGenericPassword',
        currentVersion: '9.0.0',
        currentSourceLabel: 'v9-label',
        authenticationTypeLabel: 'BIOMETRICS',
        error: expect.objectContaining({
          code: 'E_CRYPTO_FAILED',
          message: 'native decrypt failed',
        }),
        request: expect.objectContaining({
          purpose: module.RequestGenericPurpose.DECRYPT_PWD,
          shouldAttachTrustedVaultKeyString: false,
        }),
      }),
    );
    expect(diagnostic.debugStates.current.storedPasswordBase64).toBeUndefined();
    expect(diagnostic.debugStates.current.hasStoredPasswordBase64).toBe(true);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[keychain] Android biometrics failure diagnostic recorded',
      expect.objectContaining({
        currentVersion: '9.0.0',
      }),
    );
  });

  it('falls back to v8 biometrics and rewrites the current version when v9 read fails', async () => {
    const {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV9SetGenericPassword,
      mockLoggerWarn,
    } = await setup('9.0.0');
    const requestError = Object.assign(new Error('Failed to retrieve'), {
      code: module.KEYCHAIN_ERROR_CODES.NIL_KEYCHAIN_OBJECT,
    });
    const onPlainPassword = jest.fn();

    mockV9RequestGenericPassword.mockRejectedValueOnce(requestError);
    mockV8RequestGenericPassword.mockImplementationOnce(async options => {
      await options.onPlainPassword?.('legacy-password', {
        username: 'rabbymobile-user',
        password: 'encrypted-password',
        vaultKeyString: 'vault-key',
      });
      return { actionSuccess: true };
    });

    const result = await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.DECRYPT_PWD,
      shouldAttachTrustedVaultKeyString: false,
      onPlainPassword,
    });

    expect(result).toEqual({ actionSuccess: true });
    expect(mockV8RequestGenericPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: module.RequestGenericPurpose.DECRYPT_PWD,
        shouldAttachTrustedVaultKeyString: false,
        onPlainPassword: expect.any(Function),
      }),
    );
    expect(onPlainPassword).toHaveBeenCalledWith(
      'legacy-password',
      expect.objectContaining({
        vaultKeyString: 'vault-key',
      }),
    );
    expect(mockV9SetGenericPassword).toHaveBeenCalledWith(
      'legacy-password',
      module.KEYCHAIN_AUTH_TYPES.BIOMETRICS,
      { vaultKeyString: 'vault-key' },
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[keychain] recovered Android biometrics through legacy keychain fallback',
      expect.objectContaining({
        currentVersion: '9.0.0',
        fallbackVersion: '8.2.0-fork',
        currentRewriteSucceeded: true,
      }),
    );
  });

  it('falls back from v10 to v9 biometrics before v8 and rewrites the current version', async () => {
    const {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV10RequestGenericPassword,
      mockV10SetGenericPassword,
      mockLoggerWarn,
    } = await setup('10.0.0');
    const requestError = Object.assign(new Error('Failed to retrieve'), {
      code: module.KEYCHAIN_ERROR_CODES.NIL_KEYCHAIN_OBJECT,
    });
    const onPlainPassword = jest.fn();

    mockV10RequestGenericPassword.mockRejectedValueOnce(requestError);
    mockV9RequestGenericPassword.mockImplementationOnce(async options => {
      await options.onPlainPassword?.('v9-password', {
        username: 'rabbymobile-user',
        password: 'encrypted-password',
        vaultKeyString: 'v9-vault-key',
      });
      return { actionSuccess: true };
    });

    const result = await module.requestGenericPassword({
      purpose: module.RequestGenericPurpose.DECRYPT_PWD,
      shouldAttachTrustedVaultKeyString: false,
      onPlainPassword,
    });

    expect(result).toEqual({ actionSuccess: true });
    expect(mockV9RequestGenericPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: module.RequestGenericPurpose.DECRYPT_PWD,
        shouldAttachTrustedVaultKeyString: false,
        onPlainPassword: expect.any(Function),
      }),
    );
    expect(mockV8RequestGenericPassword).not.toHaveBeenCalled();
    expect(onPlainPassword).toHaveBeenCalledWith(
      'v9-password',
      expect.objectContaining({
        vaultKeyString: 'v9-vault-key',
      }),
    );
    expect(mockV10SetGenericPassword).toHaveBeenCalledWith(
      'v9-password',
      module.KEYCHAIN_AUTH_TYPES.BIOMETRICS,
      { vaultKeyString: 'v9-vault-key' },
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[keychain] recovered Android biometrics through legacy keychain fallback',
      expect.objectContaining({
        currentVersion: '10.0.0',
        fallbackVersion: '9.0.0',
        currentRewriteSucceeded: true,
      }),
    );
  });
});
