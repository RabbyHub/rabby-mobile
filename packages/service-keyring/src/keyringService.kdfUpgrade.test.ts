import { KEYRING_TYPE, type KeyringIntf } from '@rabby-wallet/keyring-utils';
import * as ethUtil from 'ethereumjs-util';

import {
  createKdfAwareEncryptor,
  createShippedLegacyEncryptor,
  LEGACY_ITERATIONS,
  OWASP2023_ITERATIONS,
  payloadIterationsOf,
} from '../test/kdf-encryptor';
import { KeyringService } from './keyringService';
import { keyringSdks } from './types';
import type { EncryptorAdapter } from './utils/encryptor';

// Unit contract for the vault KDF upgrade. KeyringService, its stores and the
// payload format are real; the native AES/PBKDF2 module is replaced by Node
// crypto with the same primitives (cross-checked against an Android device:
// identical PBKDF2 output for the same inputs). It does not prove MMKV
// durability or device timing.

const PASSWORD = 'public-test-password';
// Well-known public test keys (private key 1 and 2). Never real funds.
const TEST_PRIVATE_KEYS = [
  '0000000000000000000000000000000000000000000000000000000000000001',
  '0000000000000000000000000000000000000000000000000000000000000002',
];
const WATCH_ADDRESS = '0x000000000000000000000000000000000000dead';

class TestSimpleKeyring {
  static type = KEYRING_TYPE.SimpleKeyring;

  type = KEYRING_TYPE.SimpleKeyring;

  private keys: string[] = [];

  async deserialize(keys: string[] = []) {
    this.keys = [...keys];
  }

  async serialize() {
    return [...this.keys];
  }

  async getAccounts() {
    return this.keys.map(key =>
      ethUtil.bufferToHex(ethUtil.privateToAddress(Buffer.from(key, 'hex'))),
    );
  }
}

const keyringClasses = [
  TestSimpleKeyring as unknown as typeof KeyringIntf,
  keyringSdks.WatchKeyring,
];

type StoredState = ReturnType<KeyringService['store']['getState']>;

const createService = (
  encryptor: EncryptorAdapter,
  state: Partial<StoredState> = {},
) => {
  const service = new KeyringService({ encryptor, keyringClasses });
  service.loadStore(state as StoredState);
  return service;
};

const cloneState = (service: KeyringService): StoredState =>
  JSON.parse(JSON.stringify(service.store.getState()));

/** A wallet written by the shipped (5,000-iteration) app. */
const createLegacyWalletState = async () => {
  const service = createService(createShippedLegacyEncryptor());
  await service.boot(PASSWORD);
  await service.addNewKeyring(KEYRING_TYPE.SimpleKeyring, TEST_PRIVATE_KEYS);
  await service.addNewKeyring(KEYRING_TYPE.WatchAddressKeyring, {
    accounts: [WATCH_ADDRESS],
  });
  const accounts = await service.getAccounts();
  const state = cloneState(service);
  service.removeAllListeners();
  return { state, accounts };
};

const decryptVault = async (encryptor: EncryptorAdapter, state: StoredState) =>
  encryptor.decrypt(PASSWORD, state.vault!);

describe('KeyringService vault KDF upgrade', () => {
  const services: KeyringService[] = [];
  const track = (service: KeyringService) => {
    services.push(service);
    return service;
  };

  afterEach(async () => {
    while (services.length) {
      const service = services.pop()!;
      await service.setLocked().catch(() => undefined);
      service.removeAllListeners();
    }
  });

  describe('new app reading data written by the old app', () => {
    it('unlocks a 5,000-iteration wallet and keeps every account', async () => {
      const legacy = await createLegacyWalletState();
      expect(payloadIterationsOf(legacy.state.booted!)).toBe(LEGACY_ITERATIONS);
      expect(payloadIterationsOf(legacy.state.vault!)).toBe(LEGACY_ITERATIONS);

      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);

      expect(await service.getAccounts()).toStrictEqual(legacy.accounts);
      expect(legacy.accounts).toHaveLength(3);
    });

    it('re-encrypts booted and vault at 600k without changing the plaintext', async () => {
      const legacy = await createLegacyWalletState();
      const legacyPlaintext = await decryptVault(
        createShippedLegacyEncryptor(),
        legacy.state,
      );
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);

      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'upgraded',
      );

      const upgraded = cloneState(service);
      expect(payloadIterationsOf(upgraded.booted!)).toBe(OWASP2023_ITERATIONS);
      expect(payloadIterationsOf(upgraded.vault!)).toBe(OWASP2023_ITERATIONS);
      expect(await decryptVault(encryptor, upgraded)).toStrictEqual(
        legacyPlaintext,
      );
      expect(await encryptor.decrypt(PASSWORD, upgraded.booted!)).toBe('true');
      // Public data outside the vault is untouched.
      expect(upgraded.unencryptedKeyringData).toStrictEqual(
        legacy.state.unencryptedKeyringData,
      );
      expect(upgraded.publicAccountSnapshot).toStrictEqual(
        legacy.state.publicAccountSnapshot,
      );

      // A fresh launch on the upgraded data unlocks with the same accounts.
      const relaunched = track(
        createService(createKdfAwareEncryptor(), upgraded),
      );
      await relaunched.submitPassword(PASSWORD);
      expect(await relaunched.getAccounts()).toStrictEqual(legacy.accounts);
      expect(await relaunched.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'up-to-date',
      );
    });

    it('still rejects a wrong password and writes nothing', async () => {
      const legacy = await createLegacyWalletState();
      const service = track(
        createService(createKdfAwareEncryptor(), legacy.state),
      );

      await expect(service.submitPassword('wrong-password')).rejects.toThrow(
        /bad decrypt|JSON|Unexpected/u,
      );
      expect(cloneState(service)).toStrictEqual(legacy.state);
    });

    it('runs the upgrade from submitPassword after the configured delay', async () => {
      const legacy = await createLegacyWalletState();
      const service = track(
        new KeyringService({
          encryptor: createKdfAwareEncryptor(),
          keyringClasses,
          vaultKeyDerivationUpgradeDelayMs: 0,
        }),
      );
      service.loadStore(legacy.state);

      await service.submitPassword(PASSWORD);
      // Unlock itself does not wait for the re-encryption.
      expect(payloadIterationsOf(service.store.getState().vault!)).toBe(
        LEGACY_ITERATIONS,
      );

      await new Promise(resolve => setTimeout(resolve, 0));
      // Joins the in-flight run started by the timer.
      await service.upgradeVaultKeyDerivationIfNeeded();
      expect(payloadIterationsOf(service.store.getState().vault!)).toBe(
        OWASP2023_ITERATIONS,
      );
      expect(payloadIterationsOf(service.store.getState().booted!)).toBe(
        OWASP2023_ITERATIONS,
      );
    });

    it('refreshes the biometric vault key for the re-encrypted vault', async () => {
      const legacy = await createLegacyWalletState();
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);

      const onTrustedVaultKeyString = jest.fn();
      await service.upgradeVaultKeyDerivationIfNeeded({
        onTrustedVaultKeyString,
      });
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onTrustedVaultKeyString).toHaveBeenCalledTimes(1);
      const [keyString] = onTrustedVaultKeyString.mock.calls[0];
      expect(
        await encryptor.decryptWithExportedKey(
          service.store.getState().vault!,
          keyString,
        ),
      ).toStrictEqual(await decryptVault(encryptor, legacy.state));
    });

    it('falls back to the password when the cached key predates the upgrade', async () => {
      const legacy = await createLegacyWalletState();
      const legacyKey = (
        await createShippedLegacyEncryptor().decryptWithDetail(
          PASSWORD,
          legacy.state.vault!,
        )
      ).exportedKeyString!;
      const service = track(
        createService(createKdfAwareEncryptor(), legacy.state),
      );
      await service.submitPassword(PASSWORD);
      await service.upgradeVaultKeyDerivationIfNeeded();
      const upgraded = cloneState(service);

      const relaunched = track(
        createService(createKdfAwareEncryptor(), upgraded),
      );
      await relaunched.submitPassword(PASSWORD, {
        trustedPassword: true,
        trustedVaultKeyString: legacyKey,
      });
      expect(await relaunched.getAccounts()).toStrictEqual(legacy.accounts);
    });
  });

  describe('old app reading data written by the new app', () => {
    it('cannot unlock 600k data but leaves it intact for the next upgrade', async () => {
      const legacy = await createLegacyWalletState();
      const service = track(
        createService(createKdfAwareEncryptor(), legacy.state),
      );
      await service.submitPassword(PASSWORD);
      await service.upgradeVaultKeyDerivationIfNeeded();
      const upgraded = cloneState(service);

      // Downgrade: the shipped app ignores keyMetadata and derives 5,000.
      const downgraded = track(
        createService(createShippedLegacyEncryptor(), upgraded),
      );
      // The wrong key fails the AES-CBC padding check (or, rarely, JSON.parse).
      await expect(downgraded.submitPassword(PASSWORD)).rejects.toThrow(
        /bad decrypt|JSON|Unexpected/u,
      );
      expect(cloneState(downgraded)).toStrictEqual(upgraded);

      // Upgrading again unlocks the untouched data.
      const reupgraded = track(
        createService(createKdfAwareEncryptor(), cloneState(downgraded)),
      );
      await reupgraded.submitPassword(PASSWORD);
      expect(await reupgraded.getAccounts()).toStrictEqual(legacy.accounts);
    });

    it('can still open a 600k vault with an exported key cached before the downgrade', async () => {
      // Exported keys hold the derived AES key, whose format is unchanged.
      const legacy = await createLegacyWalletState();
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);
      await service.upgradeVaultKeyDerivationIfNeeded();
      const upgraded = cloneState(service);
      const { exportedKeyString } = await encryptor.decryptWithDetail(
        PASSWORD,
        upgraded.vault!,
      );

      const downgraded = track(
        createService(createShippedLegacyEncryptor(), upgraded),
      );
      await downgraded.submitPassword(PASSWORD, {
        trustedPassword: true,
        trustedVaultKeyString: exportedKeyString,
      });
      expect(await downgraded.getAccounts()).toStrictEqual(legacy.accounts);
    });

    it('keeps reading 5,000-iteration payloads that the old app writes after a downgrade', async () => {
      const { state, accounts } = await createLegacyWalletState();
      const service = track(createService(createKdfAwareEncryptor(), state));
      await service.submitPassword(PASSWORD);
      expect(await service.getAccounts()).toStrictEqual(accounts);
    });
  });

  describe('migration data safety', () => {
    it('does not overwrite a vault written while the upgrade was running', async () => {
      const legacy = await createLegacyWalletState();
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);

      const originalEncrypt = encryptor.encrypt;
      let concurrentWrite: Promise<unknown> | null = null;
      encryptor.encrypt = async (password, object) => {
        if (!concurrentWrite) {
          // A user action persists a new account mid-upgrade.
          concurrentWrite = service.addNewKeyring(
            KEYRING_TYPE.WatchAddressKeyring,
            {
              accounts: ['0x000000000000000000000000000000000000beef'],
            },
          );
          await concurrentWrite;
        }
        return originalEncrypt(password, object);
      };

      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'skipped-changed',
      );
      encryptor.encrypt = originalEncrypt;

      const after = cloneState(service);
      const vault = await decryptVault(encryptor, after);
      // The concurrent write survives; it was written at 600k by the new app.
      expect(payloadIterationsOf(after.vault!)).toBe(OWASP2023_ITERATIONS);
      expect(JSON.stringify(vault)).toContain(
        '0x000000000000000000000000000000000000beef',
      );
      expect(JSON.stringify(vault)).toContain(TEST_PRIVATE_KEYS[0]);

      // booted is still legacy, so the next run finishes the job.
      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'upgraded',
      );
      expect(payloadIterationsOf(service.store.getState().booted!)).toBe(
        OWASP2023_ITERATIONS,
      );
    });

    it('writes nothing when the read-back check fails', async () => {
      const legacy = await createLegacyWalletState();
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);
      const before = cloneState(service);

      // Simulate a broken writer: encrypts different content than given.
      const originalEncrypt = encryptor.encrypt;
      encryptor.encrypt = (password, object) =>
        originalEncrypt(password, Array.isArray(object) ? [] : object);

      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe('failed');
      expect(cloneState(service)).toStrictEqual(before);
    });

    it('writes nothing when encryption throws', async () => {
      const legacy = await createLegacyWalletState();
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);
      const before = cloneState(service);

      encryptor.encrypt = async () => {
        throw new Error('native module unavailable');
      };

      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe('failed');
      expect(cloneState(service)).toStrictEqual(before);
    });

    it('writes nothing if the password changes during the upgrade', async () => {
      const legacy = await createLegacyWalletState();
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);

      const originalDecrypt = encryptor.decrypt;
      let changed: Promise<void> | null = null;
      encryptor.decrypt = async (password, encrypted) => {
        const result = await originalDecrypt(password, encrypted);
        if (!changed) {
          changed = service.updatePassword(PASSWORD, 'next-public-password');
          await changed;
        }
        return result;
      };

      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'skipped-changed',
      );
      encryptor.decrypt = originalDecrypt;

      const relaunched = track(
        createService(createKdfAwareEncryptor(), cloneState(service)),
      );
      await relaunched.submitPassword('next-public-password');
      expect(await relaunched.getAccounts()).toStrictEqual(legacy.accounts);
    });

    it('upgrades from the stored vault even when runtime keyrings are deferred', async () => {
      const legacy = await createLegacyWalletState();
      const legacyPlaintext = await decryptVault(
        createShippedLegacyEncryptor(),
        legacy.state,
      );
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD, {
        deferKeyringRuntimeRestore: true,
      });
      expect(service.isKeyringRuntimeReady()).toBe(false);

      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'upgraded',
      );
      expect(await decryptVault(encryptor, cloneState(service))).toStrictEqual(
        legacyPlaintext,
      );
    });

    it('does not upgrade once the wallet locks before the scheduled run', async () => {
      const legacy = await createLegacyWalletState();
      const encryptor = createKdfAwareEncryptor();
      const service = track(
        new KeyringService({
          encryptor,
          keyringClasses,
          vaultKeyDerivationUpgradeDelayMs: 0,
        }),
      );
      service.loadStore(legacy.state);
      await service.submitPassword(PASSWORD);
      encryptor.derivations.clear();
      await service.setLocked();
      // Give the (cancelled) timer a chance to fire.
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(encryptor.derivations.size).toBe(0);
      expect(cloneState(service).vault).toBe(legacy.state.vault);
      expect(cloneState(service).booted).toBe(legacy.state.booted);
      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'skipped-locked',
      );
    });

    it('deduplicates concurrent upgrade requests', async () => {
      const legacy = await createLegacyWalletState();
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor, legacy.state));
      await service.submitPassword(PASSWORD);
      encryptor.derivations.clear();

      const [first, second] = await Promise.all([
        service.upgradeVaultKeyDerivationIfNeeded(),
        service.upgradeVaultKeyDerivationIfNeeded(),
      ]);
      expect(first).toBe('upgraded');
      expect(second).toBe('upgraded');
      // booted + vault: one 600k encrypt and one 600k read-back each.
      expect(encryptor.derivations.get(OWASP2023_ITERATIONS)).toBe(4);
    });

    it('never rewrites a payload that is stronger than the target', async () => {
      const legacy = await createLegacyWalletState();
      const stronger = createKdfAwareEncryptor(900_000);
      const service = track(createService(stronger, legacy.state));
      await service.submitPassword(PASSWORD);
      await service.upgradeVaultKeyDerivationIfNeeded();
      const strongerState = cloneState(service);

      const current = track(
        createService(createKdfAwareEncryptor(), strongerState),
      );
      await current.submitPassword(PASSWORD);
      expect(await current.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'up-to-date',
      );
      expect(payloadIterationsOf(cloneState(current).vault!)).toBe(900_000);
    });

    it('does nothing for an encryptor without KDF reporting', async () => {
      const legacy = await createLegacyWalletState();
      const service = track(
        createService(createShippedLegacyEncryptor(), legacy.state),
      );
      await service.submitPassword(PASSWORD);

      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'unsupported',
      );
      expect(cloneState(service)).toStrictEqual(legacy.state);
    });
  });

  describe('new wallets', () => {
    it('writes booted and vault at 600k from the start', async () => {
      const encryptor = createKdfAwareEncryptor();
      const service = track(createService(encryptor));
      await service.boot(PASSWORD);
      await service.addNewKeyring(
        KEYRING_TYPE.SimpleKeyring,
        TEST_PRIVATE_KEYS.slice(0, 1),
      );

      const state = cloneState(service);
      expect(payloadIterationsOf(state.booted!)).toBe(OWASP2023_ITERATIONS);
      expect(payloadIterationsOf(state.vault!)).toBe(OWASP2023_ITERATIONS);
      expect(await service.upgradeVaultKeyDerivationIfNeeded()).toBe(
        'up-to-date',
      );
    });
  });
});
