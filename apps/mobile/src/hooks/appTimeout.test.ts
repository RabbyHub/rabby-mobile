const mockAutoLockEventAddListener = jest.fn();
const mockEnsureServiceApiReady = jest.fn();
const mockGetPersistedAutoLockTimes = jest.fn();
const mockRefreshAutolockTimeout = jest.fn();
const mockSetPreferenceSync = jest.fn();

let mockPersistedMinutes = 24 * 60;
let mockAutoLockStoreState: {
  autoLockTime: number;
  minutes: number;
};

jest.mock('@/constant/autoLock', () => ({
  DEFAULT_AUTO_LOCK_MINUTES: 24 * 60,
}));

jest.mock('@/core/apis/autoLock', () => ({
  autoLockEvent: {
    addListener: (...args: unknown[]) => mockAutoLockEventAddListener(...args),
  },
  coerceAutoLockTimeout: (ms: number) => ({
    minutes: ms / (60 * 1000),
    timeoutMs: ms,
  }),
  getPersistedAutoLockTimes: () =>
    mockGetPersistedAutoLockTimes(mockPersistedMinutes),
  isValidAutoLockTime: (ms: number) => ms > 0,
  refreshAutolockTimeout: () => mockRefreshAutolockTimeout(),
}));

jest.mock('@/core/apis/lock', () => ({
  getUnlockTime: () => 0,
  unlockTimeEvent: {
    addListener: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('@/core/serviceApi/createDeferredServiceApi', () => ({
  ensureServiceApiReady: (...args: unknown[]) =>
    mockEnsureServiceApiReady(...args),
}));

jest.mock('@/core/serviceApi/preference', () => ({
  setPreferenceSync: (...args: unknown[]) => mockSetPreferenceSync(...args),
}));

jest.mock('@/core/utils/reexports', () => ({
  zCreate: (
    initializer: () => {
      autoLockTime: number;
      minutes: number;
    },
  ) => {
    let state = initializer();
    mockAutoLockStoreState = state;

    const store = (selector: (value: typeof state) => unknown) =>
      selector(state);
    store.setState = (
      updater:
        | Partial<typeof state>
        | ((value: typeof state) => Partial<typeof state>),
    ) => {
      const nextState =
        typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...nextState };
      mockAutoLockStoreState = state;
    };

    return store;
  },
}));

let appTimeoutModule: typeof import('./appTimeout');

describe('hooks/appTimeout', () => {
  beforeAll(() => {
    appTimeoutModule = require('./appTimeout');
  });

  beforeEach(() => {
    mockPersistedMinutes = 24 * 60;
    mockAutoLockEventAddListener.mockClear();
    mockEnsureServiceApiReady.mockReset();
    mockGetPersistedAutoLockTimes.mockImplementation(minutes => ({
      expireTime: 0,
      minutes,
      timeoutMs: minutes * 60 * 1000,
    }));
    mockRefreshAutolockTimeout.mockReset();
    mockSetPreferenceSync.mockReset();
  });

  it('rehydrates the auto-lock setting after preferenceService becomes ready', async () => {
    let resolvePreferenceService: (() => void) | undefined;
    mockEnsureServiceApiReady.mockReturnValue(
      new Promise<void>(resolve => {
        resolvePreferenceService = resolve;
      }),
    );

    expect(mockAutoLockStoreState.minutes).toBe(24 * 60);

    const hydrationPromise =
      appTimeoutModule.startAppTimeoutAutoLockHydration();

    mockPersistedMinutes = 5;
    resolvePreferenceService?.();
    await hydrationPromise;

    expect(mockEnsureServiceApiReady).toHaveBeenCalledWith('preferenceService');
    expect(mockAutoLockStoreState.minutes).toBe(5);
  });

  it('writes the setting synchronously before refreshing the timer', () => {
    const callOrder: string[] = [];
    mockSetPreferenceSync.mockImplementation(
      (preference: { autoLockTime: number }) => {
        mockPersistedMinutes = preference.autoLockTime;
        callOrder.push(`write:${preference.autoLockTime}`);
      },
    );
    mockRefreshAutolockTimeout.mockImplementation(() => {
      callOrder.push(`refresh:${mockPersistedMinutes}`);
    });

    appTimeoutModule.onAutoLockTimeMsChange(5 * 60 * 1000);

    expect(callOrder).toEqual(['write:5', 'refresh:5']);
  });
});
