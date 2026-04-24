describe('core/apis/keychain current facade', () => {
  const setup = async (version: '8.2.0-fork' | '9.0.0') => {
    jest.resetModules();

    const mockV8RequestGenericPassword = jest.fn(async () => 'v8-request');
    const mockV9RequestGenericPassword = jest.fn(async () => 'v9-request');
    const mockV8ResetGenericPassword = jest.fn(async () => true);
    const mockV9ResetGenericPassword = jest.fn(async () => true);

    jest.doMock('@/hooks/appSettings', () => ({
      getCurrentKeychainVersion: jest.fn(() => version),
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
      parseKeychainError: jest.fn(),
    }));
    jest.doMock('./keychainV8_2_0', () => ({
      KEYCHAIN_SOURCE_LABEL: 'v8-label',
      makeSecureKeyChainInstance: jest.fn(() => 'v8-instance'),
      requestGenericPassword: mockV8RequestGenericPassword,
      getSupportedBiometryType: jest.fn(async () => 'Fingerprint'),
      getKeychainDebugState: jest.fn(async () => ({ sourceLabel: 'v8-label' })),
      debugRemoveCurrentCipherStorageMarker: jest.fn(async () => true),
      debugWriteMockLegacyBiometricsEntry: jest.fn(async () => true),
      debugDecryptStoredPasswordPayload: jest.fn(async () => ({
        password: 'v8',
      })),
      setGenericPassword: jest.fn(async () => undefined),
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
      getKeychainDebugState: jest.fn(async () => ({ sourceLabel: 'v9-label' })),
      debugRemoveCurrentCipherStorageMarker: jest.fn(async () => true),
      debugWriteMockLegacyBiometricsEntry: jest.fn(async () => true),
      debugDecryptStoredPasswordPayload: jest.fn(async () => ({
        password: 'v9',
      })),
      setGenericPassword: jest.fn(async () => undefined),
      resetGenericPassword: mockV9ResetGenericPassword,
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
      mockV8ResetGenericPassword,
      mockV9ResetGenericPassword,
    };
  };

  it('routes facade calls to the configured v8 implementation', async () => {
    const {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV8ResetGenericPassword,
      mockV9ResetGenericPassword,
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
    expect(mockV8ResetGenericPassword).toHaveBeenCalled();
    expect(mockV9ResetGenericPassword).not.toHaveBeenCalled();
  });

  it('routes facade calls to the configured v9 implementation', async () => {
    const {
      module,
      mockV8RequestGenericPassword,
      mockV9RequestGenericPassword,
      mockV8ResetGenericPassword,
      mockV9ResetGenericPassword,
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
    expect(mockV8ResetGenericPassword).not.toHaveBeenCalled();
    expect(mockV9ResetGenericPassword).toHaveBeenCalled();
  });
});
