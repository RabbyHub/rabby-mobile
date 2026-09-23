import Aes from 'react-native-aes-crypto';
import SimpleKeyring from '@rabby-wallet/eth-simple-keyring';
import { ObservableStore } from '@metamask/obs-store';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  KeyringService,
  type KeyringServiceOptions,
} from '../../../../../packages/service-keyring/src/keyringService';
import RNEncryptor from './encryptor';
import { createKeyringStatePersistence } from '../storage/keyringStatePersistence';
import type { KeyringStateStorage } from '../storage/keyringStateMigration';

// JS integration: real encryptor, service, keyring and ObservableStore. Node
// crypto substitutes only the native AES/PBKDF2 boundary. The durable callback
// below models synchronous storage; this does not prove native durability.
jest.mock('react-native-aes-crypto', () => {
  const crypto: typeof import('node:crypto') = require('node:crypto');
  const { Buffer } = require('node:buffer');

  return {
    randomKey: jest.fn(async (length: number) =>
      crypto.randomBytes(length).toString('hex'),
    ),
    pbkdf2: jest.fn(
      async (
        password: string,
        salt: string,
        iterations: number,
        length: number,
        algorithm: string,
      ) =>
        crypto
          .pbkdf2Sync(password, salt, iterations, length / 8, algorithm)
          .toString('hex'),
    ),
    encrypt: jest.fn(
      async (text: string, key: string, iv: string, algorithm: string) => {
        const cipher = crypto.createCipheriv(
          algorithm,
          Buffer.from(key, 'hex'),
          Buffer.from(iv, 'hex'),
        );
        return Buffer.concat([
          cipher.update(text, 'utf8'),
          cipher.final(),
        ]).toString('base64');
      },
    ),
    decrypt: jest.fn(
      async (text: string, key: string, iv: string, algorithm: string) => {
        const decipher = crypto.createDecipheriv(
          algorithm,
          Buffer.from(key, 'hex'),
          Buffer.from(iv, 'hex'),
        );
        return Buffer.concat([
          decipher.update(text, 'base64'),
          decipher.final(),
        ]).toString('utf8');
      },
    ),
  };
});

const nativePbkdf2 = jest.mocked(Aes.pbkdf2).getMockImplementation()!;
const nativeEncrypt = jest.mocked(Aes.encrypt).getMockImplementation()!;
const nativeDecrypt = jest.mocked(Aes.decrypt).getMockImplementation()!;
const password = 'integration-only password 🔐';
const privateKey = '11'.repeat(32);
const strongerMetadata = {
  algorithm: 'PBKDF2' as const,
  params: { iterations: 600000 as const },
};
const legacyEncryptor = new RNEncryptor();
const upgradedEncryptor = new RNEncryptor({
  keyDerivationOptions: strongerMetadata,
});
type PersistedState = ReturnType<KeyringService['store']['getState']>;
const subscriptions: (() => void)[] = [];

function memoryStorage(initial: PersistedState): KeyringStateStorage {
  const data = new Map([['keyring', JSON.stringify(initial)]]);
  return {
    contains: key => data.has(key),
    delete: key => {
      data.delete(key);
    },
    getString: key => data.get(key),
    set: (key, value) => {
      data.set(key, value);
    },
  };
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function createFixture({
  vaultEncryptor = legacyEncryptor,
  bootedEncryptor = legacyEncryptor,
} = {}) {
  const keyring = new SimpleKeyring([privateKey]);
  const [address] = await keyring.getAccounts();
  const rawVault = [
    {
      type: KEYRING_TYPE.SimpleKeyring,
      data: await keyring.serialize(),
      // Runtime serialize() does not retain unknown serialized fields.
      // Encryption upgrades must preserve them, including during lazy restore.
      futureMetadata: { retained: 'raw vault extension' },
    },
  ];
  const state: PersistedState = {
    vault: await vaultEncryptor.encrypt(password, rawVault),
    booted: await bootedEncryptor.encrypt(password, 'true'),
    unencryptedKeyringData: [],
    hasEncryptedKeyringData: true,
    publicAccountSnapshot: {
      version: 4,
      updatedAt: 123,
      accounts: [
        {
          address,
          type: KEYRING_TYPE.SimpleKeyring,
          brandName: KEYRING_TYPE.SimpleKeyring,
        },
      ],
    },
    passwordState: { version: 1, origin: 'user' },
  };
  return { state, rawVault, address };
}

function openService(
  state: PersistedState,
  {
    encryptor = upgradedEncryptor,
    persist = true,
  }: { encryptor?: RNEncryptor; persist?: boolean } = {},
) {
  const keyringStorage = memoryStorage(state);
  const checkpointStorage = memoryStorage(state);
  const persistence = createKeyringStatePersistence({
    key: 'keyring',
    keyringStorage,
    checkpointStorage,
  });
  const commits: PersistedState[] = [];
  const persistState: NonNullable<
    KeyringServiceOptions['onPersistVaultUpgrade']
  > = nextState => {
    persistence.persistVaultUpgrade(nextState);
    commits.push(copy(nextState));
    return true;
  };
  const service = new KeyringService({
    encryptor,
    keyringClasses: [SimpleKeyring],
    onCreateKeyring: () => new SimpleKeyring(),
    ...(persist ? { onPersistVaultUpgrade: persistState } : {}),
  });
  service.loadStore(copy(state));
  const subscribedStore = service.store;
  subscribedStore.subscribe(persistence.onStoreUpdate);
  subscriptions.push(() =>
    subscribedStore.unsubscribe(persistence.onStoreUpdate),
  );
  return {
    service,
    commits,
    readDurable: (): PersistedState =>
      JSON.parse(keyringStorage.getString('keyring')!),
    readCheckpoint: (): PersistedState =>
      JSON.parse(checkpointStorage.getString('keyring')!),
  };
}

function expectIterations(encrypted: string | undefined, count: number) {
  expect(encrypted).toBeDefined();
  expect(JSON.parse(encrypted!).keyMetadata?.params.iterations ?? 5000).toBe(
    count,
  );
}

function pauseFirstUpgradedDerivation() {
  let release!: () => void;
  let started!: () => void;
  const released = new Promise<void>(resolve => {
    release = resolve;
  });
  const pending = new Promise<void>(resolve => {
    started = resolve;
  });
  let paused = false;
  jest.mocked(Aes.pbkdf2).mockImplementation(async (...args) => {
    if (!paused && args[2] === 600000) {
      paused = true;
      started();
      await released;
    }
    return nativePbkdf2(...args);
  });
  return { pending, release };
}

describe('password vault upgrade integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Aes.pbkdf2).mockReset().mockImplementation(nativePbkdf2);
    jest.mocked(Aes.encrypt).mockReset().mockImplementation(nativeEncrypt);
    jest.mocked(Aes.decrypt).mockReset().mockImplementation(nativeDecrypt);
  });

  afterEach(() => {
    subscriptions.splice(0).forEach(unsubscribe => unsubscribe());
  });

  it('keeps default-disabled unlocks at 5k without rewriting either credential', async () => {
    const { state } = await createFixture();
    const { service, commits, readDurable } = openService(state, {
      encryptor: legacyEncryptor,
    });
    const before = copy(service.store.getState());

    await service.submitPassword(password);

    expect(service.store).toBeInstanceOf(ObservableStore);
    expect(service.isUnlocked()).toBe(true);
    expect(copy(service.store.getState())).toEqual(before);
    expect(readDurable()).toEqual(state);
    expect(commits).toEqual([]);
  });

  it('commits both 600k credentials once and publishes a cached key valid after restart', async () => {
    const { state, rawVault, address } = await createFixture();
    const { service, commits, readDurable, readCheckpoint } =
      openService(state);
    const cachedKeys: string[] = [];

    await service.submitPassword(password, {
      onTrustedVaultKeyString: value => {
        cachedKeys.push(value);
      },
    });

    expect(service.isUnlocked()).toBe(true);
    expect(commits).toHaveLength(1);
    expect(readCheckpoint()).toEqual(state);
    const persisted = readDurable();
    expectIterations(persisted.vault, 600000);
    expectIterations(persisted.booted, 600000);
    expect(persisted.vault).not.toBe(state.vault);
    expect(persisted.booted).not.toBe(state.booted);
    expect(copy(service.store.getState())).toEqual(persisted);
    expect(persisted.passwordState).toEqual(state.passwordState);
    expect(persisted.publicAccountSnapshot).toEqual(
      state.publicAccountSnapshot,
    );
    expect(cachedKeys).toHaveLength(1);
    await expect(
      legacyEncryptor.decrypt(password, persisted.vault!),
    ).resolves.toEqual(rawVault);
    await expect(
      legacyEncryptor.decryptWithExportedKey(persisted.vault!, cachedKeys[0]),
    ).resolves.toEqual(rawVault);

    const restart = openService(persisted);
    await expect(
      restart.service.verifyPassword(password),
    ).resolves.toBeUndefined();
    await expect(
      restart.service.verifyPassword('wrong password'),
    ).rejects.toThrow();
    jest.mocked(Aes.pbkdf2).mockClear();
    await restart.service.submitPassword(password, {
      trustedPassword: true,
      trustedVaultKeyString: cachedKeys[0],
    });
    expect(restart.service.isUnlocked()).toBe(true);
    expect(await restart.service.keyrings[0].getAccounts()).toEqual([address]);
    expect(Aes.pbkdf2).not.toHaveBeenCalled();
    expect(restart.commits).toEqual([]);
  });

  it('does not change storage or publish keys when the password is wrong', async () => {
    const { state } = await createFixture();
    const { service, commits, readDurable } = openService(state);
    const cachedKeys: string[] = [];

    await expect(
      service.submitPassword('incorrect password', {
        onTrustedVaultKeyString: key => {
          cachedKeys.push(key);
        },
      }),
    ).rejects.toThrow();

    expect(service.isUnlocked()).toBe(false);
    expect(readDurable()).toEqual(state);
    expect(commits).toEqual([]);
    expect(cachedKeys).toEqual([]);
  });

  it('requires an acknowledged durable callback before upgrading', async () => {
    const { state } = await createFixture();
    const { service } = openService(state, { persist: false });
    const before = copy(service.store.getState());

    await service.submitPassword(password);

    expect(service.isUnlocked()).toBe(true);
    expect(copy(service.store.getState())).toEqual(before);
  });

  it.each(['valid', 'invalid'] as const)(
    'does not migrate during a cached-key unlock with a %s cache',
    async cache => {
      const { state } = await createFixture();
      const { service, commits, readDurable } = openService(state);
      const detail = await legacyEncryptor.decryptWithDetail(
        password,
        state.vault!,
      );
      jest.mocked(Aes.pbkdf2).mockClear();
      // The exported key can unlock the vault even when the accompanying
      // password is wrong; that password must never create replacement data.
      await service.submitPassword(
        cache === 'valid' ? 'wrong password' : password,
        {
          trustedPassword: true,
          trustedVaultKeyString:
            cache === 'valid' ? detail.exportedKeyString : 'invalid cache',
        },
      );

      expect(service.isUnlocked()).toBe(true);
      expect(commits).toEqual([]);
      expect(readDurable()).toEqual(state);
      if (cache === 'valid') {
        expect(Aes.pbkdf2).not.toHaveBeenCalled();
      }
    },
  );

  it.each(['vault', 'booted'] as const)(
    'upgrades only the remaining legacy %s without rewriting the other 600k credential',
    async legacyField => {
      const { state } = await createFixture({
        vaultEncryptor:
          legacyField === 'vault' ? legacyEncryptor : upgradedEncryptor,
        bootedEncryptor:
          legacyField === 'booted' ? legacyEncryptor : upgradedEncryptor,
      });
      const { service, commits, readDurable } = openService(state);

      await service.submitPassword(password);

      const persisted = readDurable();
      expect(commits).toHaveLength(1);
      expectIterations(persisted.vault, 600000);
      expectIterations(persisted.booted, 600000);
      const unchangedField = legacyField === 'vault' ? 'booted' : 'vault';
      expect(persisted[unchangedField]).toBe(state[unchangedField]);
      expect(persisted[legacyField]).not.toBe(state[legacyField]);
    },
  );

  it('never downgrades credentials when the configured target returns to 5k', async () => {
    const { state } = await createFixture({
      vaultEncryptor: upgradedEncryptor,
      bootedEncryptor: upgradedEncryptor,
    });
    const { service, commits, readDurable } = openService(state, {
      encryptor: legacyEncryptor,
    });

    await service.submitPassword(password);

    expect(commits).toEqual([]);
    expect(readDurable()).toEqual(state);
  });

  it('preserves the raw vault while secret keyrings are deferred', async () => {
    const { state, rawVault, address } = await createFixture();
    const { service, commits, readDurable } = openService(state);

    await service.submitPassword(password, {
      deferKeyringRuntimeRestore: true,
      deferMemStoreKeyringsUpdate: true,
    });

    expect(commits).toHaveLength(1);
    expect(service.isUnlocked()).toBe(true);
    expect(service.isKeyringRuntimeReady()).toBe(false);
    expect(service.keyrings).toEqual([]);
    await expect(
      legacyEncryptor.decrypt(password, readDurable().vault!),
    ).resolves.toEqual(rawVault);
    await service.startDeferredKeyringRuntimeRestore('integration');
    expect(service.isKeyringRuntimeReady()).toBe(true);
    expect(await service.keyrings[0].getAccounts()).toEqual([address]);
  });

  it.each([false, true])(
    'backfills legacy public metadata without losing raw vault fields when upgrade failure is %s',
    async failUpgrade => {
      const { state, rawVault } = await createFixture();
      delete state.publicAccountSnapshot;
      delete state.unencryptedKeyringData;
      const { service, commits, readDurable } = openService(state);
      if (failUpgrade) {
        jest
          .mocked(Aes.encrypt)
          .mockRejectedValue(new Error('native encryption unavailable'));
      }

      await service.submitPassword(password);

      expect(service.isUnlocked()).toBe(true);
      expect(service.hasPublicAccountSnapshot()).toBe(true);
      expect(service.store.getState().unencryptedKeyringData).toEqual([]);
      const persisted = readDurable();
      await expect(
        legacyEncryptor.decrypt(password, persisted.vault!),
      ).resolves.toEqual(rawVault);
      if (failUpgrade) {
        expect(commits).toEqual([]);
        expect(persisted.vault).toBe(state.vault);
        expect(persisted.booted).toBe(state.booted);
      } else {
        expect(commits).toHaveLength(1);
        expectIterations(persisted.vault, 600000);
        expectIterations(persisted.booted, 600000);
      }
    },
  );

  it.each(['lock', 'replace store'] as const)(
    'abandons public metadata backfill when an unlock listener schedules %s during serialization',
    async transitionKind => {
      const { state } = await createFixture();
      const replacement = (await createFixture()).state;
      replacement.publicAccountSnapshot!.updatedAt = 456;
      delete state.publicAccountSnapshot;
      delete state.unencryptedKeyringData;
      const { service, commits, readDurable } = openService(state);
      const previousStore = service.store;
      const before = copy(previousStore.getState());
      let transitionedState = before;
      let transition: Promise<unknown> | undefined;
      service.once('unlock', () => {
        transition = Promise.resolve().then(async () => {
          if (transitionKind === 'lock') {
            await service.setLocked();
          } else {
            service.loadStore(copy(replacement));
          }
          transitionedState = copy(service.store.getState());
        });
      });
      jest.mocked(Aes.encrypt).mockClear();

      await service.submitPassword(password);
      await transition;

      expect(copy(previousStore.getState())).toEqual(before);
      expect(copy(service.store.getState())).toEqual(transitionedState);
      expect(readDurable()).toEqual(state);
      expect(commits).toEqual([]);
      expect(Aes.encrypt).not.toHaveBeenCalled();
      if (transitionKind === 'lock') {
        expect(service.isUnlocked()).toBe(false);
        expect(service.store.getState().publicAccountSnapshot).toBeUndefined();
        expect(service.store.getState().unencryptedKeyringData).toBeUndefined();
      } else {
        expect(service.store).not.toBe(previousStore);
        expect(service.store.getState().publicAccountSnapshot?.updatedAt).toBe(
          456,
        );
      }
    },
  );

  it('retains both old credentials if creating the booted replacement fails', async () => {
    const { state, rawVault } = await createFixture();
    const { service, commits, readDurable } = openService(state);
    const before = copy(service.store.getState());
    const cachedKeys: string[] = [];
    jest.mocked(Aes.encrypt).mockImplementation(async (...args) => {
      if (args[0] === JSON.stringify('true')) {
        throw new Error('native encryption unavailable');
      }
      return nativeEncrypt(...args);
    });

    await service.submitPassword(password, {
      onTrustedVaultKeyString: key => {
        cachedKeys.push(key);
      },
    });

    expect(service.isUnlocked()).toBe(true);
    expect(commits).toEqual([]);
    expect(readDurable()).toEqual(state);
    expect(copy(service.store.getState())).toEqual(before);
    expect(cachedKeys).toHaveLength(1);
    await expect(
      legacyEncryptor.decryptWithExportedKey(state.vault!, cachedKeys[0]),
    ).resolves.toEqual(rawVault);
  });

  it('does not commit ciphertext when native encryption fails its roundtrip check', async () => {
    const { state } = await createFixture();
    const { service, commits, readDurable } = openService(state);
    jest
      .mocked(Aes.encrypt)
      .mockImplementation(async (...args) =>
        nativeEncrypt(
          args[0] === JSON.stringify('true') ? 'null' : '[]',
          ...(args.slice(1) as [string, string, string]),
        ),
      );

    await service.submitPassword(password);

    expect(service.isUnlocked()).toBe(true);
    expect(commits).toEqual([]);
    expect(readDurable()).toEqual(state);
  });

  it.each(['throw', 'reject'] as const)(
    'keeps the old state and a successful unlock when durable storage reports %s',
    async failure => {
      const { state } = await createFixture();
      const service = new KeyringService({
        encryptor: upgradedEncryptor,
        keyringClasses: [SimpleKeyring],
        onCreateKeyring: () => new SimpleKeyring(),
        onPersistVaultUpgrade: () => {
          if (failure === 'throw') {
            throw new Error('storage unavailable');
          }
          return false as true;
        },
      });
      service.loadStore(copy(state));
      const before = copy(service.store.getState());

      await service.submitPassword(password);

      expect(service.isUnlocked()).toBe(true);
      expect(copy(service.store.getState())).toEqual(before);
      await expect(service.verifyPassword(password)).resolves.toBeUndefined();
    },
  );

  it('tolerates a rejected cached-key write after a committed upgrade', async () => {
    const { state } = await createFixture();
    const { service, commits, readDurable } = openService(state);

    await service.submitPassword(password, {
      onTrustedVaultKeyString: async () => {
        throw new Error('keychain unavailable');
      },
    });
    await Promise.resolve();

    expect(service.isUnlocked()).toBe(true);
    expect(commits).toHaveLength(1);
    expectIterations(readDurable().vault, 600000);
    await expect(service.verifyPassword(password)).resolves.toBeUndefined();
  });

  it('abandons an in-flight upgrade when the wallet locks', async () => {
    const { state } = await createFixture();
    const { service, commits, readDurable } = openService(state);
    const gate = pauseFirstUpgradedDerivation();
    const cachedKeys: string[] = [];
    const unlocking = service.submitPassword(password, {
      onTrustedVaultKeyString: key => {
        cachedKeys.push(key);
      },
    });
    await gate.pending;
    await service.setLocked();
    gate.release();
    await unlocking;

    expect(service.isUnlocked()).toBe(false);
    expect(service.keyrings).toEqual([]);
    expect(commits).toEqual([]);
    expect(readDurable()).toEqual(state);
    expect(cachedKeys).toEqual([]);
  });

  it('does not overwrite a newer vault written during derivation', async () => {
    const { state, rawVault } = await createFixture();
    const replacement = await legacyEncryptor.encrypt(password, rawVault);
    const { service, commits } = openService(state);
    const gate = pauseFirstUpgradedDerivation();
    const unlocking = service.submitPassword(password);
    await gate.pending;
    service.store.updateState({ vault: replacement });
    gate.release();
    await unlocking;

    expect(service.store.getState().vault).toBe(replacement);
    expect(service.store.getState().booted).toBe(state.booted);
    expect(commits).toEqual([]);
  });

  it('does not overwrite credentials from a concurrent password change', async () => {
    const { state } = await createFixture();
    const { service, commits } = openService(state);
    const gate = pauseFirstUpgradedDerivation();
    const unlocking = service.submitPassword(password);
    await gate.pending;
    const nextPassword = 'replacement integration-only password';
    await service.updatePassword(password, nextPassword);
    const afterChange = copy(service.store.getState());
    gate.release();
    await unlocking;

    expect(copy(service.store.getState())).toEqual(afterChange);
    expect(commits).toEqual([]);
    await expect(service.verifyPassword(nextPassword)).resolves.toBeUndefined();
    await expect(service.verifyPassword(password)).rejects.toThrow();
  });

  it('serializes cache writes so a previous unlock cannot overwrite the latest key', async () => {
    const { state, rawVault } = await createFixture();
    const { service } = openService(state);
    const newerLegacyVault = await legacyEncryptor.encrypt(password, rawVault);
    let cache = '';
    let releaseFirst!: () => void;
    let reportStarted!: () => void;
    let reportFinished!: () => void;
    const started = new Promise<void>(resolve => {
      reportStarted = resolve;
    });
    const firstWrite = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    const finished = new Promise<void>(resolve => {
      reportFinished = resolve;
    });
    const writeOrder: string[] = [];

    await service.submitPassword(password, {
      onTrustedVaultKeyString: async key => {
        writeOrder.push('first-start');
        reportStarted();
        await firstWrite;
        cache = key;
        writeOrder.push('first-finish');
      },
    });
    await started;
    await service.setLocked();
    service.store.updateState({ vault: newerLegacyVault });
    await service.submitPassword(password, {
      onTrustedVaultKeyString: key => {
        cache = key;
        writeOrder.push('second');
        reportFinished();
      },
    });
    expect(writeOrder).toEqual(['first-start']);
    releaseFirst();
    await finished;

    expect(writeOrder).toEqual(['first-start', 'first-finish', 'second']);
    await expect(
      legacyEncryptor.decryptWithExportedKey(
        service.store.getState().vault!,
        cache,
      ),
    ).resolves.toEqual(rawVault);
  });
});
