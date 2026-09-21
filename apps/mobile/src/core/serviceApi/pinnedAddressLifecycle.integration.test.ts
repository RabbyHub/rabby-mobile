import type { StorageAdapater } from '@rabby-wallet/persist-store';

// This integration test intentionally composes the real service and API.
import { registerService } from '@/core/services/serviceRegistry';
import { PreferenceService } from '@/core/startupServices/preference';
import {
  getPinnedAddresses,
  getPinnedAddressSnapshot,
  updatePinnedAddresses,
} from './preference';
import { updatePinnedAddressList } from '@/store/pinnedAddresses';

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    logScreenView: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(async () => undefined),
  }),
}));

function createSerializedMemoryStorage(): StorageAdapater {
  const values = new Map<string, string>();

  return {
    getItem: key => {
      const value = values.get(String(key));
      return value === undefined ? null : JSON.parse(value);
    },
    setItem: (key, value) => {
      values.set(String(key), JSON.stringify(value));
    },
    removeItem: key => {
      values.delete(String(key));
    },
    clearAll: () => values.clear(),
  };
}

describe('pinned-address preference lifecycle integration', () => {
  it('keeps the synchronous snapshot, async API, and reconstructed service consistent', async () => {
    const firstAddress = {
      address: '0xAbCd000000000000000000000000000000001234',
      brandName: 'Rabby',
    };
    const secondAddress = {
      address: '0xDef0000000000000000000000000000000005678',
      brandName: 'Rabby',
    };
    const storage = createSerializedMemoryStorage();
    const preferenceService = new PreferenceService({
      storageAdapter: storage,
    });
    preferenceService.updatePinAddresses([firstAddress]);
    preferenceService.persistStoreImmediately();
    const unregisterPreference = registerService(
      'preferenceService',
      preferenceService,
    );

    try {
      expect(getPinnedAddressSnapshot()).toEqual([firstAddress]);
      await expect(getPinnedAddresses()).resolves.toEqual([firstAddress]);

      const { nextAddresses } = updatePinnedAddressList(
        await getPinnedAddresses(),
        { ...secondAddress, nextPinned: true },
      );
      await updatePinnedAddresses(nextAddresses);
      preferenceService.persistStoreImmediately();

      expect(getPinnedAddressSnapshot()).toEqual([secondAddress, firstAddress]);

      const reconstructedService = new PreferenceService({
        storageAdapter: storage,
      });
      expect(reconstructedService.getPinAddresses()).toEqual([
        secondAddress,
        firstAddress,
      ]);
    } finally {
      unregisterPreference();
    }
  });
});
