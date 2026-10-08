import { KEYRING_TYPE, type KeyringIntf } from '@rabby-wallet/keyring-utils';

import { KeyringService } from './keyringService';
import { keyringSdks } from './types';
import type { EncryptorAdapter } from './utils/encryptor';

const ADDRESS = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
const PASSWORD = 'public-test-password';

// Unit contract for an injected Keyring class. Repository Service methods and
// ObservableStores remain real; this does not prove the mobile SDK or Hermes.
describe('KeyringService private-key initialization', () => {
  let initialize: (keys: string[]) => Promise<string[]>;
  let service: KeyringService;
  let onSetAddressAlias: jest.Mock;

  class AsyncSimpleKeyring {
    static type = KEYRING_TYPE.SimpleKeyring;

    type = KEYRING_TYPE.SimpleKeyring;

    private accounts: string[] = [];

    constructor(opts?: string[]) {
      if (opts) {
        // Model the external constructor's discarded initialization promise.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.deserialize(opts);
      }
    }

    async deserialize(keys: string[] = []) {
      this.accounts = await initialize(keys);
    }

    async getAccounts() {
      return this.accounts;
    }

    async serialize() {
      return this.accounts;
    }

    async addAccounts() {
      this.accounts.push(ADDRESS);
      return [ADDRESS];
    }
  }

  const encryptor: EncryptorAdapter = {
    encrypt: async (_password, data) => JSON.stringify(data),
    decrypt: async (_password, data) => JSON.parse(data),
    decryptWithDetail: async (_password, data) => ({ vault: JSON.parse(data) }),
    decryptWithExportedKey: async data => JSON.parse(data),
  };

  beforeEach(async () => {
    initialize = async keys => (keys.length > 0 ? [ADDRESS] : []);
    onSetAddressAlias = jest.fn(async () => undefined);
    service = new KeyringService({
      encryptor,
      keyringClasses: [
        AsyncSimpleKeyring as unknown as typeof KeyringIntf,
        keyringSdks.WatchKeyring,
      ],
      onSetAddressAlias,
    });
    service.loadStore({});
    await service.boot(PASSWORD);
    await service.persistAllKeyrings();
  });

  afterEach(() => {
    service.removeAllListeners();
  });

  it('waits for initialization before adding, aliasing, or persisting an import', async () => {
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>(resolve => {
      entered = resolve;
    });
    const releasedPromise = new Promise<void>(resolve => {
      release = resolve;
    });
    initialize = async () => {
      entered();
      await releasedPromise;
      return [ADDRESS];
    };

    const importing = service.importPrivateKey('public-fixture');
    await enteredPromise;
    expect(service.keyrings).toHaveLength(0);
    expect(JSON.parse(service.store.getState().vault!)).toStrictEqual([]);
    expect(onSetAddressAlias).not.toHaveBeenCalled();

    release();
    const keyring = await importing;
    expect(await keyring.getAccounts()).toStrictEqual([ADDRESS]);
    expect(await service.getAccounts()).toStrictEqual([ADDRESS]);
    expect(JSON.parse(service.store.getState().vault!)).toStrictEqual([
      { type: KEYRING_TYPE.SimpleKeyring, data: [ADDRESS] },
    ]);
    expect(onSetAddressAlias).toHaveBeenCalledWith(
      keyring,
      {
        address: ADDRESS,
        type: KEYRING_TYPE.SimpleKeyring,
        brandName: KEYRING_TYPE.SimpleKeyring,
      },
      undefined,
    );
  });

  it('rejects an asynchronous decoder failure before storing an empty keyring', async () => {
    const error = new Error('invalid private key');
    initialize = async () => {
      await Promise.resolve();
      throw error;
    };
    const previousVault = service.store.getState().vault;

    await expect(
      service.importPrivateKey('public-invalid-fixture'),
    ).rejects.toBe(error);

    expect(service.keyrings).toHaveLength(0);
    expect(await service.getAccounts()).toStrictEqual([]);
    expect(service.store.getState().vault).toBe(previousVault);
    expect(onSetAddressAlias).not.toHaveBeenCalled();
  });

  it.each([
    { accounts: [] },
    { accounts: [''] },
    { accounts: ['0xinvalid'] },
    { accounts: [ADDRESS, '0xinvalid'] },
  ])(
    'rejects imports whose decoder produces invalid accounts: $accounts',
    async ({ accounts }) => {
      initialize = async () => accounts;
      const previousVault = service.store.getState().vault;

      await expect(service.importPrivateKey('public-fixture')).rejects.toThrow(
        'Failed to derive a valid address from private key',
      );

      expect(service.keyrings).toHaveLength(0);
      expect(service.store.getState().vault).toBe(previousVault);
      expect(onSetAddressAlias).not.toHaveBeenCalled();
    },
  );

  it.each([{ opts: undefined }, { opts: [] }])(
    'preserves empty SimpleKeyring creation followed by addAccounts: $opts',
    async ({ opts }) => {
      const keyring = await service.addNewKeyring(
        KEYRING_TYPE.SimpleKeyring,
        opts,
      );

      expect(await keyring.getAccounts()).toStrictEqual([]);
      await service.addNewAccount(keyring);
      expect(await service.getAccounts()).toStrictEqual([ADDRESS]);
    },
  );

  it('preserves watch-keyring constructor options and empty creation', async () => {
    const empty = await service.addNewKeyring(KEYRING_TYPE.WatchAddressKeyring);
    expect(await empty.getAccounts()).toStrictEqual([]);

    const watch = await service.addNewKeyring(
      KEYRING_TYPE.WatchAddressKeyring,
      {
        accounts: [ADDRESS],
      },
    );
    expect(await watch.getAccounts()).toStrictEqual([ADDRESS]);
    expect(await service.getAccounts()).toStrictEqual([ADDRESS]);
  });
});
