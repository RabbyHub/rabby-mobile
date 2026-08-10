import { AppState, type AppStateStatus } from 'react-native';
import type { StorageAdapater } from '@rabby-wallet/persist-store';

// The integration test intentionally constructs the real startup service.
/* eslint-disable no-runtime-service-imports */
import { registerService } from '@/core/services/serviceRegistry';
import { PreferenceService } from '@/core/startupServices/preference';
/* eslint-enable no-runtime-service-imports */
import { autoLockEvent, handleUnlock, setupAutoLockChecker } from './autoLock';

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    logScreenView: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(async () => undefined),
  }),
}));

type AppStateListener = (state: AppStateStatus) => void;

const mockAppStateListeners = new Set<AppStateListener>();

function createMemoryStorage(): StorageAdapater {
  const values = new Map<string, unknown>();

  return {
    getItem: key => values.get(String(key)) as never,
    setItem: (key, value) => {
      values.set(String(key), value);
    },
    removeItem: key => {
      values.delete(String(key));
    },
    clearAll: () => values.clear(),
  };
}

function emitAppStateChange(state: AppStateStatus) {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: state,
  });
  [...mockAppStateListeners].forEach(listener => listener(state));
}

describe('auto-lock foreground lifecycle integration', () => {
  it('keeps an active session before expiry and requests lock after background timeout', () => {
    jest.useFakeTimers();
    const consoleDebugSpy = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    let now = 10_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    const addEventListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event, listener) => {
        if (event === 'change') {
          mockAppStateListeners.add(listener);
        }
        return {
          remove: () => mockAppStateListeners.delete(listener),
        };
      });
    const preferenceService = new PreferenceService({
      storageAdapter: createMemoryStorage(),
    });
    preferenceService.setPreference({ autoLockTime: 1 });
    const unregisterPreference = registerService(
      'preferenceService',
      preferenceService,
    );
    const timeouts: Array<{
      reason: 'foreground' | 'back-to-foreground';
      delayLock: () => void;
    }> = [];
    const onTimeout = (context: (typeof timeouts)[number]) => {
      timeouts.push(context);
    };

    autoLockEvent.on('timeout', onTimeout);

    try {
      handleUnlock();
      setupAutoLockChecker();
      // Align the module singleton with the mocked native boundary before the
      // first background transition.
      emitAppStateChange('active');

      now = 20_000;
      emitAppStateChange('background');
      now = 50_000;
      emitAppStateChange('active');
      expect(timeouts).toEqual([]);

      now = 60_000;
      emitAppStateChange('background');
      now = 121_000;
      emitAppStateChange('active');

      expect(timeouts).toHaveLength(1);
      expect(timeouts[0].reason).toBe('back-to-foreground');
    } finally {
      autoLockEvent.off('timeout', onTimeout);
      unregisterPreference();
      mockAppStateListeners.clear();
      jest.clearAllTimers();
      jest.useRealTimers();
      addEventListenerSpy.mockRestore();
      dateNowSpy.mockRestore();
      consoleDebugSpy.mockRestore();
    }
  });
});
