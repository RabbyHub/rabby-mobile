const mockVerifyPassword = jest.fn();
const mockUpdatePassword = jest.fn();
const mockResetPassword = jest.fn();
const mockDangerouslyResetPasswordAndKeyrings = jest.fn();
const mockGetCountOfAccountsInKeyring = jest.fn();
const mockIsBooted = jest.fn();
const mockIsUnlocked = jest.fn();
const mockIsKeyringRuntimeReady = jest.fn();
const mockEnsureKeyringRuntimeReady = jest.fn();
const mockBoot = jest.fn();
const mockSubmitPassword = jest.fn();
const mockRestoreUnencryptedKeyrings = jest.fn();
const mockSetLocked = jest.fn();
const mockHasPublicAccountSnapshot = jest.fn();
const mockKeyringOn = jest.fn();
const mockKeyringOff = jest.fn();
const mockRefreshMemStoreKeyrings = jest.fn();
const mockGetPreference = jest.fn();
const mockSetPreference = jest.fn();
const mockInitCurrentAccount = jest.fn();
const mockBroadcastEvent = jest.fn();
const mockCheckMultipleFailed = jest.fn();
const mockResetMultipleFailed = jest.fn();
const mockShouldRejectUnlockDueToMultipleFailed = jest.fn();
const mockRefreshAutolockTimeout = jest.fn();
const mockGetPersistedUnlockSessionExpireTime = jest.fn();
const mockPerfEmit = jest.fn();
const mockPerfListenerCount = jest.fn();
const mockRecordKeyringRuntimeConvergenceDiagnostic = jest.fn();
const mockRunAfterHomePostStartupReady = jest.fn(
  (callback: () => void, _options?: unknown) => {
    callback();
    return jest.fn();
  },
);

const createEventClass = () =>
  class EventEmitter {
    private listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

    on(event: string, listener: (...args: unknown[]) => void) {
      this.listeners[event] = [...(this.listeners[event] || []), listener];
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      (this.listeners[event] || []).forEach(listener => listener(...args));
      return true;
    }
  };

const keyringService = {
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  dangerouslyResetPasswordAndKeyrings: (...args: unknown[]) =>
    mockDangerouslyResetPasswordAndKeyrings(...args),
  getCountOfAccountsInKeyring: (...args: unknown[]) =>
    mockGetCountOfAccountsInKeyring(...args),
  isUnlocked: (...args: unknown[]) => mockIsUnlocked(...args),
  isKeyringRuntimeReady: (...args: unknown[]) =>
    mockIsKeyringRuntimeReady(...args),
  ensureKeyringRuntimeReady: (...args: unknown[]) =>
    mockEnsureKeyringRuntimeReady(...args),
  submitPassword: (...args: unknown[]) => mockSubmitPassword(...args),
  setLocked: (...args: unknown[]) => mockSetLocked(...args),
  hasPublicAccountSnapshot: (...args: unknown[]) =>
    mockHasPublicAccountSnapshot(...args),
  on: (...args: unknown[]) => mockKeyringOn(...args),
  off: (...args: unknown[]) => mockKeyringOff(...args),
  refreshMemStoreKeyrings: (...args: unknown[]) =>
    mockRefreshMemStoreKeyrings(...args),
  memStore: {
    getState: () => ({
      keyringRuntimeReady: mockIsKeyringRuntimeReady(),
      keyringRuntimeRestoring: false,
      keyringRuntimeRestoreError: null,
      keyrings: [],
    }),
  },
};

const preferenceService = {
  getPreference: (...args: unknown[]) => mockGetPreference(...args),
  setPreference: (...args: unknown[]) => mockSetPreference(...args),
  initCurrentAccount: (...args: unknown[]) => mockInitCurrentAccount(...args),
};

const mockResetPerpsStore = jest.fn();

const sessionService = {
  broadcastEvent: (...args: unknown[]) => mockBroadcastEvent(...args),
};

const perpsService = {
  resetStore: (...args: unknown[]) => mockResetPerpsStore(...args),
};

const loadLockModule = () => {
  jest.resetModules();

  jest.doMock('react-native', () => ({
    Platform: {
      OS: 'ios',
    },
  }));

  jest.doMock('@/constant/encryptor', () => ({
    RABBY_MOBILE_KR_PWD: 'built-in-password',
  }));

  jest.doMock('@/constant/event', () => ({
    BroadcastEvent: {
      accountsChanged: 'accountsChanged',
      lock: 'lock',
      unlock: 'unlock',
    },
  }));

  jest.doMock('../services', () => ({
    keyringService,
    perpsService,
    preferenceService,
    sessionService,
  }));

  jest.doMock('@/core/serviceApi', () => {
    const getPreferenceSnapshot = (key?: string) => {
      if (key) {
        return mockGetPreference(key);
      }

      const lastUnlockTime = mockGetPreference('lastUnlockTime');
      return lastUnlockTime === undefined
        ? undefined
        : {
            lastUnlockTime,
          };
    };

    const bindKeyringEventSync = (
      event: string,
      listener: (...args: unknown[]) => void,
    ) => {
      mockKeyringOn(event, listener);
      return () => mockKeyringOff(event, listener);
    };

    const bindKeyringEvent = async (
      event: string,
      listener: (...args: unknown[]) => void,
    ) => bindKeyringEventSync(event, listener);

    return {
      bindKeyringEvent,
      bindKeyringEventSync,
      broadcastSessionEventSync: (...args: unknown[]) =>
        mockBroadcastEvent(...args),
      getKeyringMemStoreStateSnapshot: () => keyringService.memStore.getState(),
      getPreferenceSnapshot,
      hasKeyringPublicAccountSnapshot: () => mockHasPublicAccountSnapshot(),
      initCurrentAccountSync: (...args: unknown[]) =>
        mockInitCurrentAccount(...args),
      isKeyringBootedSnapshot: () => mockIsBooted(),
      isKeyringRuntimeReadySnapshot: () => mockIsKeyringRuntimeReady(),
      isKeyringUnlockedSnapshot: () => mockIsUnlocked(),
      keyringServiceApi: {
        boot: (...args: unknown[]) => mockBoot(...args),
        dangerouslyResetPasswordAndKeyrings: (...args: unknown[]) =>
          mockDangerouslyResetPasswordAndKeyrings(...args),
        ensureKeyringRuntimeReady: (...args: unknown[]) =>
          mockEnsureKeyringRuntimeReady(...args),
        getCountOfAccountsInKeyring: (...args: unknown[]) =>
          mockGetCountOfAccountsInKeyring(...args),
        resetPassword: (...args: unknown[]) => mockResetPassword(...args),
        restoreUnencryptedKeyrings: (...args: unknown[]) =>
          mockRestoreUnencryptedKeyrings(...args),
        setLocked: (...args: unknown[]) => mockSetLocked(...args),
        submitPassword: (...args: unknown[]) => mockSubmitPassword(...args),
        updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
        verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
      },
      perpsServiceApi: {
        resetStore: (...args: unknown[]) => mockResetPerpsStore(...args),
      },
      refreshKeyringMemStoreKeyringsIfPossible: (...args: unknown[]) =>
        mockRefreshMemStoreKeyrings(...args),
      setPreferenceSync: (...args: unknown[]) => mockSetPreference(...args),
      submitKeyringPasswordForUnlock: (...args: unknown[]) =>
        mockSubmitPassword(...args),
    };
  });

  jest.doMock('./event', () => ({
    makeEEClass: () => ({
      EventEmitter: createEventClass(),
    }),
  }));

  jest.doMock('@/utils/time', () => ({
    formatTimeReadable: (seconds: number) => `${seconds}s`,
  }));

  jest.doMock('../utils/unlockRateLimit', () => ({
    resetMultipleFailed: (...args: unknown[]) =>
      mockResetMultipleFailed(...args),
    checkMultipleFailed: (...args: unknown[]) =>
      mockCheckMultipleFailed(...args),
    shouldRejectUnlockDueToMultipleFailed: (...args: unknown[]) =>
      mockShouldRejectUnlockDueToMultipleFailed(...args),
  }));

  jest.doMock('../utils/store', () => ({
    runIIFEFunc: (fn: () => unknown) => fn(),
  }));

  jest.doMock('../utils/perf', () => ({
    perfEvents: {
      emit: (...args: unknown[]) => mockPerfEmit(...args),
      listenerCount: (...args: unknown[]) => mockPerfListenerCount(...args),
    },
  }));

  jest.doMock('../utils/homeStartupReady', () => ({
    runAfterHomePostStartupReady: (...args: unknown[]) =>
      mockRunAfterHomePostStartupReady(...args),
  }));

  jest.doMock('../utils/startupDiagnostics', () => ({
    recordKeyringRuntimeConvergenceDiagnostic: (...args: unknown[]) =>
      mockRecordKeyringRuntimeConvergenceDiagnostic(...args),
  }));

  jest.doMock('./autoLock', () => ({
    getPersistedUnlockSessionExpireTime: (...args: unknown[]) =>
      mockGetPersistedUnlockSessionExpireTime(...args),
    refreshAutolockTimeout: (...args: unknown[]) =>
      mockRefreshAutolockTimeout(...args),
  }));

  jest.doMock('@/utils/logger', () => ({
    logger: {
      info: jest.fn(),
    },
  }));

  return require('./lock') as typeof import('./lock');
};

describe('core/apis/lock password and session utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-31T12:00:00.000Z'));
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    mockVerifyPassword.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue(undefined);
    mockResetPassword.mockResolvedValue(undefined);
    mockDangerouslyResetPasswordAndKeyrings.mockResolvedValue(undefined);
    mockGetCountOfAccountsInKeyring.mockResolvedValue(0);
    mockIsBooted.mockReturnValue(true);
    mockIsUnlocked.mockReturnValue(false);
    mockIsKeyringRuntimeReady.mockReturnValue(true);
    mockEnsureKeyringRuntimeReady.mockResolvedValue(undefined);
    mockBoot.mockResolvedValue(undefined);
    mockSubmitPassword.mockResolvedValue(undefined);
    mockRestoreUnencryptedKeyrings.mockResolvedValue(undefined);
    mockSetLocked.mockResolvedValue(undefined);
    mockRefreshMemStoreKeyrings.mockResolvedValue(undefined);
    mockResetPerpsStore.mockResolvedValue(undefined);
    mockHasPublicAccountSnapshot.mockReturnValue(true);
    mockGetPreference.mockReturnValue(0);
    mockShouldRejectUnlockDueToMultipleFailed.mockReturnValue({
      reject: false,
      timeDiff: 0,
    });
    mockGetPersistedUnlockSessionExpireTime.mockReturnValue(Date.now() + 1_000);
    mockPerfListenerCount.mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('parses custom validation behavior while providing default handlers', () => {
    const { parseValidationBehavior } = loadLockModule();
    const validationHandler = jest.fn();
    const onFinished = jest.fn();

    expect(
      parseValidationBehavior({
        validationHandler,
        onFinished,
      }),
    ).toEqual({
      validationHandler,
      onFinished,
    });

    const defaults = parseValidationBehavior();
    expect(defaults.validationHandler).toBeInstanceOf(Function);
    expect(defaults.onFinished).toBeInstanceOf(Function);
  });

  it('sets wallet password only after verifying the built-in password', async () => {
    const { setupWalletPassword } = loadLockModule();

    await expect(setupWalletPassword('new-password')).resolves.toEqual({
      error: '',
    });

    expect(mockVerifyPassword).toHaveBeenCalledWith('built-in-password');
    expect(mockUpdatePassword).toHaveBeenCalledWith(
      'built-in-password',
      'new-password',
    );
  });

  it('rejects invalid initial password setup inputs and verification failures', async () => {
    const { setupWalletPassword } = loadLockModule();

    await expect(setupWalletPassword('built-in-password')).resolves.toEqual({
      error: 'Incorret Password',
    });
    await expect(setupWalletPassword('')).resolves.toEqual({
      error: 'Password cannot be empty',
    });

    mockVerifyPassword.mockRejectedValue(new Error('bad built-in password'));
    await expect(setupWalletPassword('new-password')).resolves.toEqual({
      error: 'Current password is incorrect',
    });
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('updates or clears custom passwords only after current-password verification', async () => {
    const { clearCustomPassword, updateWalletPassword } = loadLockModule();

    await expect(
      updateWalletPassword('old-password', 'new-password'),
    ).resolves.toEqual({
      error: '',
    });
    expect(mockUpdatePassword).toHaveBeenCalledWith(
      'old-password',
      'new-password',
    );

    await expect(clearCustomPassword('current-password')).resolves.toEqual({
      error: '',
    });
    expect(mockUpdatePassword).toHaveBeenCalledWith(
      'current-password',
      'built-in-password',
    );

    mockVerifyPassword.mockRejectedValue(new Error('bad current password'));
    await expect(
      updateWalletPassword('bad-old-password', 'new-password'),
    ).resolves.toEqual({
      error: 'Current password is incorrect',
    });
  });

  it('decides whether setup password should be asked from lock info and account count', async () => {
    const { shouldAskSetPassword } = loadLockModule();

    mockVerifyPassword.mockResolvedValue(undefined);
    await expect(shouldAskSetPassword()).resolves.toBe(true);

    mockVerifyPassword.mockRejectedValue(new Error('custom password'));
    mockGetCountOfAccountsInKeyring.mockResolvedValue(0);
    await expect(shouldAskSetPassword()).resolves.toBe(true);

    mockGetCountOfAccountsInKeyring.mockResolvedValue(1);
    await expect(shouldAskSetPassword()).resolves.toBe(false);
  });

  it('resets password by setup path for built-in password accounts and reset path for empty keyring', async () => {
    const { resetPasswordOnUI } = loadLockModule();

    mockGetCountOfAccountsInKeyring.mockResolvedValue(1);
    mockVerifyPassword.mockResolvedValue(undefined);
    await expect(resetPasswordOnUI('new-password')).resolves.toEqual({
      error: '',
    });
    expect(mockUpdatePassword).toHaveBeenCalledWith(
      'built-in-password',
      'new-password',
    );
    expect(mockResetPassword).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockGetCountOfAccountsInKeyring.mockResolvedValue(0);
    mockVerifyPassword.mockResolvedValue(undefined);
    await expect(resetPasswordOnUI('empty-keyring-password')).resolves.toEqual({
      error: '',
    });
    expect(mockResetPassword).toHaveBeenCalledWith('empty-keyring-password');
  });

  it('fails reset when accounts exist under a custom password', async () => {
    const { resetPasswordOnUI } = loadLockModule();

    mockGetCountOfAccountsInKeyring.mockResolvedValue(1);
    mockVerifyPassword.mockRejectedValue(new Error('custom password'));

    await expect(resetPasswordOnUI('new-password')).resolves.toEqual({
      error: 'Failed to reset password',
    });
    expect(mockUpdatePassword).not.toHaveBeenCalled();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('wraps dangerous password reset with a stable error result', async () => {
    const { dangerouslyResetPasswordAndKeyrings } = loadLockModule();

    await expect(
      dangerouslyResetPasswordAndKeyrings('old-password', 'new-password'),
    ).resolves.toEqual({
      error: '',
    });
    expect(mockDangerouslyResetPasswordAndKeyrings).toHaveBeenCalledWith(
      'old-password',
      'new-password',
    );

    mockDangerouslyResetPasswordAndKeyrings.mockRejectedValue(
      new Error('reset failed'),
    );
    await expect(
      dangerouslyResetPasswordAndKeyrings('old-password'),
    ).resolves.toEqual({
      error: 'Failed to reset password an clear keyrings',
    });
  });

  it('locks wallet, clears unlock time, and broadcasts account and lock events', async () => {
    const { getUnlockTime, lockWallet } = loadLockModule();

    await lockWallet();

    expect(mockSetLocked).toHaveBeenCalled();
    expect(getUnlockTime()).toBe(0);
    expect(mockSetPreference).toHaveBeenCalledWith({
      lastUnlockTime: 0,
      unlockSessionExpireTime: 0,
    });
    expect(mockBroadcastEvent).toHaveBeenCalledWith('accountsChanged', []);
    expect(mockBroadcastEvent).toHaveBeenCalledWith('lock');
  });

  it('updates unlock time and checks persisted unlock-session validity', async () => {
    const {
      clearUnlockTime,
      getUnlockTime,
      isUnlockSessionValid,
      unlockTimeEvent,
      updateUnlockTime,
    } = loadLockModule();
    const updates: number[] = [];
    unlockTimeEvent.on('updated', time => updates.push(time as number));

    await updateUnlockTime();

    expect(getUnlockTime()).toBe(Date.now());
    expect(mockSetPreference).toHaveBeenCalledWith({
      lastUnlockTime: Date.now(),
    });
    expect(mockRefreshAutolockTimeout).toHaveBeenCalled();
    expect(updates).toEqual([Date.now()]);
    expect(isUnlockSessionValid()).toBe(true);

    mockGetPersistedUnlockSessionExpireTime.mockReturnValue(Date.now() - 1);
    expect(isUnlockSessionValid()).toBe(false);

    mockGetPersistedUnlockSessionExpireTime.mockReturnValue(-1);
    mockIsUnlocked.mockReturnValue(false);
    mockHasPublicAccountSnapshot.mockReturnValue(false);
    expect(isUnlockSessionValid()).toBe(false);

    clearUnlockTime();
    expect(updates).toEqual([Date.now(), 0]);
    expect(getUnlockTime()).toBe(0);
  });

  it('hydrates unlock time lazily when preference service becomes ready after module load', () => {
    let preferenceReady = false;
    mockGetPreference.mockImplementation(() =>
      preferenceReady ? Date.now() : undefined,
    );

    const { getUnlockTime, isUnlockSessionValid } = loadLockModule();

    expect(getUnlockTime()).toBe(0);

    preferenceReady = true;
    expect(getUnlockTime()).toBe(Date.now());
    expect(isUnlockSessionValid()).toBe(true);
  });

  it('unlocks through submitPassword and refreshes unlock time only on success', async () => {
    const { unlockWalletWithUpdateUnlockTime } = loadLockModule();

    await expect(unlockWalletWithUpdateUnlockTime('password')).resolves.toEqual(
      {
        error: '',
        formFieldError: '',
        toastError: '',
      },
    );
    expect(mockSubmitPassword).toHaveBeenCalledWith('password', {
      trustedPassword: undefined,
      trustedVaultKeyString: undefined,
      onTrustedVaultKeyString: undefined,
      deferMemStoreKeyringsUpdate: undefined,
      deferKeyringRuntimeRestore: undefined,
    });
    expect(mockResetMultipleFailed).toHaveBeenCalled();
    expect(mockInitCurrentAccount).toHaveBeenCalled();
    expect(mockBroadcastEvent).toHaveBeenCalledWith('unlock');
    expect(mockSetPreference).toHaveBeenCalledWith({
      lastUnlockTime: Date.now(),
    });

    jest.clearAllMocks();
    mockSubmitPassword.mockRejectedValue(new Error('bad password'));
    await expect(unlockWalletWithUpdateUnlockTime('bad')).resolves.toEqual({
      error: 'Incorrect password',
      formFieldError: '',
      toastError: '',
    });
    expect(mockCheckMultipleFailed).toHaveBeenCalled();
    expect(mockSetPreference).not.toHaveBeenCalledWith({
      lastUnlockTime: Date.now(),
    });
  });

  it('returns rate-limit unlock errors before submitting password', async () => {
    const { unlockWalletWithUpdateUnlockTime } = loadLockModule();
    mockShouldRejectUnlockDueToMultipleFailed.mockReturnValue({
      reject: true,
      timeDiff: 61_000,
    });

    await expect(unlockWalletWithUpdateUnlockTime('password')).resolves.toEqual(
      {
        error: 'Incorrect password',
        formFieldError: 'Too many failed attempts',
        toastError: 'Too many failed attempts, please try again after 61s',
      },
    );

    expect(mockSubmitPassword).not.toHaveBeenCalled();
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it('skips keyring runtime convergence while locked', () => {
    const { scheduleKeyringRuntimeConvergence } = loadLockModule();
    jest.clearAllMocks();
    mockIsUnlocked.mockReturnValue(false);

    scheduleKeyringRuntimeConvergence('test');

    expect(mockRunAfterHomePostStartupReady).not.toHaveBeenCalled();
    expect(mockRefreshMemStoreKeyrings).not.toHaveBeenCalled();
  });

  it('runs keyring runtime convergence after home startup when unlocked', async () => {
    const { scheduleKeyringRuntimeConvergence } = loadLockModule();
    jest.clearAllMocks();
    mockIsUnlocked.mockReturnValue(true);
    mockIsKeyringRuntimeReady.mockReturnValue(false);

    scheduleKeyringRuntimeConvergence('test');

    expect(mockRunAfterHomePostStartupReady).toHaveBeenCalledWith(
      expect.any(Function),
      {
        fallbackMs: 5000,
        label: 'keyring_runtime_convergence',
      },
    );

    await Promise.resolve();

    expect(mockRefreshMemStoreKeyrings).toHaveBeenCalledTimes(1);
  });
});
