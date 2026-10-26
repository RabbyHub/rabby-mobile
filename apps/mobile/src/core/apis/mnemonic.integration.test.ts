import HdKeyring from '@rabby-wallet/eth-hd-keyring';
import type { KeyringIntf } from '@rabby-wallet/keyring-utils';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
import { webcrypto } from 'node:crypto';

// Compose real services so missing publication cannot be hidden by API mocks.
/* eslint-disable no-runtime-service-imports */
import { KeyringService } from '@rabby-wallet/service-keyring';
import { registerService } from '@/core/services/serviceRegistry';
import { HDKeyringService } from '@/core/services/hdKeyringService';
import { PreferenceService } from '@/core/startupServices/preference';
/* eslint-enable no-runtime-service-imports */
import { bindKeyringMemStore } from '@/core/serviceApi/keyring';
import {
  buildSeedPhraseGroups,
  selectPublicHdKeyrings,
} from '@/hooks/seedPhraseGroups';
import {
  activeAndPersistAccountsByMnemonics,
  generateKeyringWithMnemonic,
} from './mnemonic';

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    logScreenView: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(async () => undefined),
  }),
}));

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ isReady: () => false }),
}));

// Public fixture only: no user wallet or native storage is involved.
const mnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function createMemoryStorage(): StorageAdapater {
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

describe('mnemonic account publication integration', () => {
  const nativeCryptoDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'crypto',
  );

  beforeAll(async () => {
    const key = await webcrypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: webcrypto.subtle,
        getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
        CryptoKey: key.constructor,
      },
    });
  });

  afterAll(() => {
    if (nativeCryptoDescriptor) {
      Object.defineProperty(globalThis, 'crypto', nativeCryptoDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'crypto');
    }
  });

  it.each([0, 1])(
    'publishes imported addresses to the seed phrase list without restarting (%i initial accounts)',
    async initialCount => {
      const storage = createMemoryStorage();
      const preference = new PreferenceService({ storageAdapter: storage });
      const hdKeyring = new HDKeyringService({ storageAdapter: storage });
      const service = new KeyringService({
        keyringClasses: [HdKeyring as unknown as typeof KeyringIntf],
      });
      service.loadStore({});
      await service.boot('mnemonic-publication-test');
      const cleanup = [
        registerService('keyringService', service),
        registerService('hdKeyringService', hdKeyring),
        registerService('preferenceService', preference),
      ];

      try {
        await generateKeyringWithMnemonic(mnemonic, '', true);
        const keyring = service.keyrings[0] as unknown as HdKeyring;
        const candidates = await keyring.getAddresses(0, 3);
        if (initialCount) {
          keyring.activeAccounts([0]);
          await service.persistAllKeyrings();
          await service.refreshMemStoreKeyrings();
        }

        let inventory = selectPublicHdKeyrings(service.memStore.getState());
        cleanup.push(
          await bindKeyringMemStore(snapshot => {
            inventory = selectPublicHdKeyrings(snapshot);
          }),
        );
        const getDisplayedAddresses = () =>
          buildSeedPhraseGroups(
            inventory,
            service.getPublicAccountSnapshotAccounts(),
            [],
            'Seed Phrase',
          ).flatMap(group => group.list.map(account => account.address));

        expect(getDisplayedAddresses()).toEqual(
          candidates.slice(0, initialCount).map(item => item.address),
        );
        for (let index = initialCount; index < candidates.length; index++) {
          await activeAndPersistAccountsByMnemonics(mnemonic, '', [
            candidates[index],
          ]);

          const expectedAddresses = candidates
            .slice(0, index + 1)
            .map(item => item.address)
            .sort();
          expect((await keyring.getAccounts()).slice().sort()).toEqual(
            expectedAddresses,
          );
          expect(
            service
              .getPublicAccountSnapshotAccounts()
              .map(account => account.address)
              .sort(),
          ).toEqual(expectedAddresses);
          expect(getDisplayedAddresses().sort()).toEqual(expectedAddresses);
        }
      } finally {
        cleanup.reverse().forEach(dispose => dispose());
      }
    },
  );
});
