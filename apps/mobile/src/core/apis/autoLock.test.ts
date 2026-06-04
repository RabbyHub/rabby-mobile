type PreferenceStore = Record<string, unknown>;

function loadAutoLockModule({
  isUnlocked = true,
  preferences = {},
}: {
  isUnlocked?: boolean;
  preferences?: PreferenceStore;
} = {}) {
  jest.resetModules();

  const store: PreferenceStore = {
    ...preferences,
  };
  const mockGetPreference = jest.fn((key: string) => store[key]);
  const mockSetPreference = jest.fn((value: PreferenceStore) => {
    Object.assign(store, value);
  });
  const mockIsUnlocked = jest.fn(() => isUnlocked);

  jest.doMock('react-native', () => ({
    AppState: {
      addEventListener: jest.fn(),
      currentState: 'active',
      isAvailable: true,
    },
  }));
  jest.doMock('@/constant/autoLock', () => ({
    DEFAULT_AUTO_LOCK_MINUTES: 5,
  }));
  jest.doMock('../services', () => ({
    keyringService: {
      isUnlocked: mockIsUnlocked,
    },
    preferenceService: {
      getPreference: (...args: unknown[]) => mockGetPreference(...args),
      setPreference: (...args: unknown[]) => mockSetPreference(...args),
    },
  }));

  const autoLockModule = require('./autoLock') as typeof import('./autoLock');

  return {
    ...autoLockModule,
    mocks: {
      mockGetPreference,
      mockIsUnlocked,
      mockSetPreference,
      store,
    },
  };
}

describe('core/apis/autoLock', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('normalizes auto-lock timeout values to whole-second millisecond durations', () => {
    const { coerceAutoLockTimeout, isValidAutoLockTime } = loadAutoLockModule();

    expect(isValidAutoLockTime(1)).toBe(true);
    expect(isValidAutoLockTime(0)).toBe(false);
    expect(coerceAutoLockTimeout(0)).toEqual({
      minutes: -1,
      timeoutMs: -1,
    });
    expect(coerceAutoLockTimeout(90_500)).toEqual({
      minutes: 1.51,
      timeoutMs: 90_000,
    });
  });

  it('derives persisted auto-lock expire time from the stored minute preference', () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
    const { getPersistedAutoLockTimes } = loadAutoLockModule({
      preferences: {
        autoLockTime: 1.5,
      },
    });

    expect(getPersistedAutoLockTimes()).toEqual({
      expireTime: 100_000,
      minutes: 1.5,
      timeoutMs: 90_000,
    });
  });

  it('derives unlock-session expiry from explicit preference or last unlock time', () => {
    const explicit = loadAutoLockModule({
      preferences: {
        unlockSessionExpireTime: -1,
      },
    });
    expect(explicit.getPersistedUnlockSessionExpireTime()).toBe(-1);

    const fromLastUnlock = loadAutoLockModule({
      preferences: {
        autoLockTime: 2,
        lastUnlockTime: 5_000,
      },
    });
    expect(fromLastUnlock.getPersistedUnlockSessionExpireTime()).toBe(125_000);
  });

  it('refreshes foreground and persisted unlock-session expiry when the wallet session can be extended', () => {
    jest.spyOn(Date, 'now').mockReturnValue(20_000);
    const { autoLockEvent, refreshAutolockTimeout, mocks } = loadAutoLockModule(
      {
        isUnlocked: true,
        preferences: {
          autoLockTime: 1,
          lastUnlockTime: 10_000,
        },
      },
    );
    const changes: number[] = [];
    autoLockEvent.on('change', expireTime => {
      changes.push(expireTime);
    });

    expect(refreshAutolockTimeout()).toBe(80_000);
    expect(mocks.store.unlockSessionExpireTime).toBe(80_000);
    expect(mocks.mockSetPreference).toHaveBeenCalledWith({
      unlockSessionExpireTime: 80_000,
    });

    expect(refreshAutolockTimeout('clear')).toBe(-1);
    expect(changes).toEqual([80_000, -1]);
  });
});
