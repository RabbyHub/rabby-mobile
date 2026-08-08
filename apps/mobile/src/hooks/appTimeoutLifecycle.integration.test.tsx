import { act, renderHook } from '@testing-library/react-native';
import type { StorageAdapater } from '@rabby-wallet/persist-store';

// This integration test intentionally composes the real startup service.
/* eslint-disable no-runtime-service-imports */
import { registerService } from '@/core/services/serviceRegistry';
import { PreferenceService } from '@/core/startupServices/preference';
/* eslint-enable no-runtime-service-imports */
import {
  onAutoLockTimeMsChange,
  startAppTimeoutAutoLockHydration,
  useAutoLockTime,
} from './appTimeout';

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    logScreenView: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(async () => undefined),
  }),
}));

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

describe('app timeout preference lifecycle integration', () => {
  it('hydrates from the real preference service and writes changes back before refreshing', async () => {
    const preferenceService = new PreferenceService({
      storageAdapter: createMemoryStorage(),
    });
    preferenceService.setPreference({ autoLockTime: 5 });
    const unregisterPreference = registerService(
      'preferenceService',
      preferenceService,
    );

    try {
      await act(async () => {
        await startAppTimeoutAutoLockHydration();
      });

      const { result } = renderHook(() => useAutoLockTime());
      expect(result.current.timeoutMs).toBe(5 * 60 * 1000);

      act(() => {
        onAutoLockTimeMsChange(7 * 60 * 1000);
      });

      expect(result.current.timeoutMs).toBe(7 * 60 * 1000);
      expect(preferenceService.getPreference('autoLockTime')).toBe(7);
    } finally {
      unregisterPreference();
    }
  });
});
