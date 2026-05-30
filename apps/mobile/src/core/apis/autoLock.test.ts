const mockGetPreference = jest.fn();
const mockSetPreference = jest.fn();
const mockIsUnlocked = jest.fn();

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

const loadAutoLockModule = () => {
  jest.resetModules();

  jest.doMock('react-native', () => ({
    AppState: {
      currentState: 'active',
      isAvailable: true,
      addEventListener: jest.fn(() => ({
        remove: jest.fn(),
      })),
    },
  }));

  jest.doMock('@/constant/autoLock', () => ({
    DEFAULT_AUTO_LOCK_MINUTES: 15,
  }));

  jest.doMock('../services', () => ({
    keyringService: {
      isUnlocked: (...args: unknown[]) => mockIsUnlocked(...args),
    },
    preferenceService: {
      getPreference: (...args: unknown[]) => mockGetPreference(...args),
      setPreference: (...args: unknown[]) => mockSetPreference(...args),
    },
  }));

  jest.doMock('./event', () => ({
    makeEEClass: () => ({
      EventEmitter: createEventClass(),
    }),
  }));

  return require('./autoLock') as typeof import('./autoLock');
};

describe('core/apis/autoLock', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
    jest.clearAllMocks();
    mockGetPreference.mockImplementation((key: string) => {
      if (key === 'autoLockTime') {
        return 2;
      }
      if (key === 'lastUnlockTime') {
        return Date.now() - 1000;
      }
      if (key === 'unlockSessionExpireTime') {
        return 0;
      }
      return undefined;
    });
    mockIsUnlocked.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('coerces auto-lock timeout values into minute and millisecond precision', () => {
    const { coerceAutoLockTimeout, isValidAutoLockTime } = loadAutoLockModule();

    expect(isValidAutoLockTime(1)).toBe(true);
    expect(isValidAutoLockTime(0)).toBe(false);
    expect(coerceAutoLockTimeout(90_123)).toEqual({
      minutes: 1.5,
      timeoutMs: 90_000,
    });
    expect(coerceAutoLockTimeout(0)).toEqual({
      minutes: -1,
      timeoutMs: -1,
    });
  });

  it('builds persisted auto-lock times from the configured preference', () => {
    const { getPersistedAutoLockTimes } = loadAutoLockModule();

    expect(getPersistedAutoLockTimes()).toEqual({
      minutes: 2,
      timeoutMs: 120_000,
      expireTime: Date.now() + 120_000,
    });
  });

  it('derives unlock session expiry from explicit preference or last unlock time', () => {
    const { getPersistedUnlockSessionExpireTime } = loadAutoLockModule();

    mockGetPreference.mockImplementation((key: string) => {
      if (key === 'unlockSessionExpireTime') {
        return -1;
      }
      return undefined;
    });
    expect(getPersistedUnlockSessionExpireTime()).toBe(-1);

    mockGetPreference.mockImplementation((key: string) => {
      if (key === 'unlockSessionExpireTime') {
        return Date.now() + 10_000;
      }
      return undefined;
    });
    expect(getPersistedUnlockSessionExpireTime()).toBe(Date.now() + 10_000);

    mockGetPreference.mockImplementation((key: string) => {
      if (key === 'autoLockTime') {
        return 2;
      }
      if (key === 'lastUnlockTime') {
        return Date.now() - 1_000;
      }
      return 0;
    });
    expect(getPersistedUnlockSessionExpireTime()).toBe(
      Date.now() - 1_000 + 120_000,
    );
  });

  it('refreshes foreground expiry and persisted unlock session when refresh is allowed', () => {
    const { autoLockEvent, refreshAutolockTimeout } = loadAutoLockModule();
    const changes: number[] = [];
    autoLockEvent.on('change', expireTime => {
      changes.push(expireTime as number);
    });

    expect(refreshAutolockTimeout()).toBe(Date.now() + 120_000);

    expect(mockSetPreference).toHaveBeenCalledWith({
      unlockSessionExpireTime: Date.now() + 120_000,
    });
    expect(changes).toEqual([Date.now() + 120_000]);
  });

  it('clears foreground expiry without writing persisted unlock session', () => {
    const { autoLockEvent, refreshAutolockTimeout } = loadAutoLockModule();
    const changes: number[] = [];
    autoLockEvent.on('change', expireTime => {
      changes.push(expireTime as number);
    });

    expect(refreshAutolockTimeout('clear')).toBe(-1);

    expect(mockSetPreference).not.toHaveBeenCalled();
    expect(changes).toEqual([-1]);
  });
});
