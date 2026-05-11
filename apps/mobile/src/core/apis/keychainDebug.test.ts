describe('core/apis/keychainDebug', () => {
  const setup = async () => {
    jest.resetModules();

    const mockGetGenericPassword = jest.fn(async () => ({
      service: 'com.debank',
      username: 'rabbymobile-user',
      password: 'encrypted-password',
      storage: 'KeystoreRSAECB',
    }));
    const mockSetGenericPassword = jest.fn(async () => ({
      service: 'com.debank',
      storage: 'KeystoreRSAECB',
    }));
    const mockResetGenericPassword = jest.fn(async () => true);
    const mockGetSupportedBiometryType = jest.fn(async () => 'Fingerprint');
    const mockDebugGetGenericPasswordStateForOptions = jest.fn(async () => ({
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
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      NativeModules: {
        RNKeychainManager: {
          debugGetGenericPasswordStateForOptions:
            mockDebugGetGenericPasswordStateForOptions,
          debugRemoveCipherStorageMarkerForOptions:
            mockDebugRemoveCipherStorageMarkerForOptions,
        },
      },
    }));
    jest.doMock('react-native-keychain', () => {
      const OfficialKeychain = {
        getGenericPassword: mockGetGenericPassword,
        setGenericPassword: mockSetGenericPassword,
        resetGenericPassword: mockResetGenericPassword,
        getSupportedBiometryType: mockGetSupportedBiometryType,
        ACCESSIBLE: {
          WHEN_UNLOCKED_THIS_DEVICE_ONLY:
            'AccessibleWhenUnlockedThisDeviceOnly',
        },
        ACCESS_CONTROL: {
          BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
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
    jest.doMock('./keychainCommon', () => ({
      ANDROID_AUTH_PROMPT_POLICIES: {
        INTERACTIVE_FIRST: 'interactive-first',
        ALLOW_AUTHENTICATED_SESSION_REUSE: 'allow-authenticated-session-reuse',
      },
      DEFAULT_ANDROID_AUTH_PROMPT_POLICY: 'interactive-first',
      KEYCHAIN_DEFAULT_SERVICE: 'com.debank',
      KEYCHAIN_STORAGE_TYPES: {
        RSA: 'KeystoreRSAECB',
        AES: 'KeystoreAESCBC',
        KC: 'keychain',
      },
      coerceKeychainStorageType: jest.fn((storage?: string) => {
        switch (storage) {
          case 'KeystoreRSAECB':
          case 'KeystoreAESCBC':
          case 'keychain':
            return storage;
          default:
            return 'KeystoreRSAECB';
        }
      }),
      getAuthenticationType: jest.fn(() => 1),
      getAuthenticationTypeLabel: jest.fn(() => 'BIOMETRICS'),
      getAndroidAuthPromptPolicyOptions: jest.fn((policy?: string) =>
        policy === 'allow-authenticated-session-reuse'
          ? { androidAllowAuthenticatedSessionReuse: true }
          : {},
      ),
      isAuthenticatedByBiometrics: jest.fn(() => true),
    }));
    jest.doMock('@/utils/i18n', () => ({
      __esModule: true,
      default: {
        t: (key: string) => key,
      },
    }));

    let module!: typeof import('./keychainDebug');
    jest.isolateModules(() => {
      module = require('./keychainDebug');
    });

    return {
      module,
      mockGetGenericPassword,
      mockSetGenericPassword,
    };
  };

  it('reads generic passwords with official raw keychain defaults for the requested service', async () => {
    const { module, mockGetGenericPassword } = await setup();

    const result = await module.readGenericPassword('com.debank');

    expect(mockGetGenericPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'com.debank',
        authenticationType: 'AuthenticationWithBiometrics',
        rules: 'automaticUpgradeToMoreSecuredStorage',
        authenticationPrompt: expect.objectContaining({
          title: 'native.authentication.auth_prompt_title',
          description: 'native.authentication.auth_prompt_desc',
          cancel: 'native.authentication.auth_prompt_cancel',
        }),
      }),
    );
    expect(result).toEqual({
      service: 'com.debank',
      username: 'rabbymobile-user',
      password: 'encrypted-password',
      storage: 'KeystoreRSAECB',
    });
  });

  it('passes the Android authenticated-session reuse option to raw official reads when requested', async () => {
    const { module, mockGetGenericPassword } = await setup();

    await module.readGenericPassword('com.debank', {
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

  it('writes biometrics entries to the requested service using official raw keychain defaults', async () => {
    const { module, mockSetGenericPassword } = await setup();

    const result = await module.writeBiometricsEntry(
      'plain-password',
      'com.debank',
    );

    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'rabbymobile-user',
      'plain-password',
      expect.objectContaining({
        service: 'com.debank',
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
        accessControl: 'BiometryCurrentSet',
      }),
    );
    expect(result).toEqual({
      service: 'com.debank',
      storage: 'KeystoreRSAECB',
    });
  });

  it('passes an explicit storage through raw official writes', async () => {
    const { module, mockSetGenericPassword } = await setup();

    await module.writeBiometricsEntry('plain-password', 'com.debank', {
      storage: module.KEYCHAIN_STORAGE_TYPES.AES,
    });

    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'rabbymobile-user',
      'plain-password',
      expect.objectContaining({
        service: 'com.debank',
        storage: 'KeystoreAESCBC',
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

  it('reports iOS keychain debug state as an iOS-specific union branch', async () => {
    jest.resetModules();

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
        RNKeychainManager: {
          debugGetGenericPasswordStateForOptions:
            mockDebugGetGenericPasswordStateForOptions,
        },
      },
    }));
    jest.doMock('react-native-keychain', () => {
      const OfficialKeychain = {
        getGenericPassword: jest.fn(),
        setGenericPassword: jest.fn(),
        resetGenericPassword: jest.fn(),
        getSupportedBiometryType: jest.fn(async () => 'FaceID'),
        ACCESSIBLE: {
          WHEN_UNLOCKED_THIS_DEVICE_ONLY:
            'AccessibleWhenUnlockedThisDeviceOnly',
        },
        ACCESS_CONTROL: {
          BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
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
    jest.doMock('./keychainCommon', () => ({
      ANDROID_AUTH_PROMPT_POLICIES: {
        INTERACTIVE_FIRST: 'interactive-first',
        ALLOW_AUTHENTICATED_SESSION_REUSE: 'allow-authenticated-session-reuse',
      },
      DEFAULT_ANDROID_AUTH_PROMPT_POLICY: 'interactive-first',
      KEYCHAIN_DEFAULT_SERVICE: 'com.debank',
      KEYCHAIN_STORAGE_TYPES: {
        RSA: 'KeystoreRSAECB',
        AES: 'KeystoreAESCBC',
        KC: 'keychain',
      },
      getAuthenticationType: jest.fn(() => 1),
      getAuthenticationTypeLabel: jest.fn(() => 'BIOMETRICS'),
      getAndroidAuthPromptPolicyOptions: jest.fn(() => ({})),
      isAuthenticatedByBiometrics: jest.fn(() => true),
    }));
    jest.doMock('@/utils/i18n', () => ({
      __esModule: true,
      default: {
        t: (key: string) => key,
      },
    }));

    let module!: typeof import('./keychainDebug');
    jest.isolateModules(() => {
      module = require('./keychainDebug');
    });

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
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
        hasAccessControl: true,
        itemClass: 'genericPassword',
        debugSupported: true,
        supportedBiometryType: 'FaceID',
      }),
    );
  });
});
