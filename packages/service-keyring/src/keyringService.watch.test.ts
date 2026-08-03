import * as sinon from 'sinon';
import { KeyringService } from '../src/keyringService';
import mockEncryptor from '../test/mock-encryptor';
import { KEYRING_TYPE, KeyringTypeName } from '@rabby-wallet/keyring-utils';
import { keyringSdks } from '../src/types';

const password = 'password123';
const walletOneSeedWords =
  'puzzle seed penalty soldier say clay field arctic metal hen cage runway';

describe('KeyringService setup', () => {
  let keyringService: KeyringService;

  beforeAll(() => {
    keyringService = new KeyringService({ encryptor: mockEncryptor as any });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('boot', () => {
    it('should load store', async () => {
      keyringService.loadStore({});
      expect(keyringService.store).not.toBeUndefined();
    });

    it('should booted', async () => {
      keyringService.boot('password');
      expect(keyringService.store.getState().booted).toBeUndefined();
    });
  });

  describe('setLocked', () => {
    it('setLocked correctly sets lock state', async () => {
      await keyringService.setLocked();
      await expect(keyringService.persistAllKeyrings()).rejects.toThrow(
        'KeyringService - password is not a string',
      );
      expect(keyringService.memStore.getState().isUnlocked).toBe(false);
      expect(keyringService.keyrings).toHaveLength(0);
    });

    it('emits "lock" event', async () => {
      const spy = sinon.spy();
      keyringService.on('lock', spy);
      await keyringService.setLocked();
      expect(spy.calledOnce).toBe(true);
    });
  });
});

describe('keyringService support eth-keyring-watch', () => {
  let keyringService: KeyringService;

  const TEST_ADDR = '0x39b97205b9826f21fd39b535cf972c809e160e5f';
  const TEST_ADDR_2 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const TEST_HD_ADDR = '0x1111111111111111111111111111111111111111';

  class TestHdKeyring {
    static type = KEYRING_TYPE.HdKeyring;

    type = KEYRING_TYPE.HdKeyring;

    byImport = true;

    publicKey = 'base-public-key';

    hasBackup = true;

    needPassphrase = true;

    private accounts = [TEST_HD_ADDR];

    async serialize() {
      return {
        mnemonic: walletOneSeedWords,
        accounts: this.accounts,
      };
    }

    async deserialize(data: { accounts?: string[] }) {
      this.accounts = data.accounts || [];
    }

    async getAccounts() {
      return this.accounts;
    }

    async getAccountsWithBrand() {
      return this.accounts.map(address => ({
        address,
        brandName: 'Rabby Wallet',
      }));
    }

    async getInfoByAddress() {
      return {
        basePublicKey: 'base-public-key',
        hdPathType: 'LedgerLive',
        index: 0,
      };
    }
  }

  beforeEach(async () => {
    keyringService = new KeyringService({ encryptor: mockEncryptor as any });
    keyringService.loadStore({});
    await keyringService.boot(password);
    await keyringService.clearKeyrings();
  });

  afterEach(() => {
    sinon.restore();
  });

  async function addWatchAddress(address = TEST_ADDR) {
    const keyring = await keyringService.addNewKeyring(
      KEYRING_TYPE.WatchAddressKeyring as KeyringTypeName,
    );

    keyring.setAccountToAdd(address);
    await keyringService.addNewAccount(keyring);
  }

  function setSensitiveHdKeyringInRuntime() {
    keyringService.keyrings = [
      {
        type: KEYRING_TYPE.HdKeyring,
        byImport: true,
        publicKey: 'base-public-key',
        hasBackup: true,
        needPassphrase: true,
        serialize: async () => ({
          mnemonic: walletOneSeedWords,
          accounts: [TEST_HD_ADDR],
        }),
        getAccounts: async () => [TEST_HD_ADDR],
        getAccountsWithBrand: async () => [
          {
            address: TEST_HD_ADDR,
            brandName: 'Rabby Wallet',
          },
        ],
        getInfoByAddress: async () => ({
          basePublicKey: 'base-public-key',
          hdPathType: 'LedgerLive',
          index: 0,
        }),
      } as any,
    ];
  }

  describe('keyring', () => {
    it('#addNewKeyring', async () => {
      const spy = sinon.spy();
      const spyCallback = sinon.spy();

      keyringService.on('newAccount', spy);
      expect(spy.calledOnce).toBe(false);
      expect(spyCallback.calledOnce).toBe(false);

      let keyring = await keyringService.addNewKeyring(
        'Watch Address' as KeyringTypeName,
      );

      keyring.setAccountToAdd(TEST_ADDR);

      keyringService.addListener('newAccount', spyCallback);

      await keyringService.addNewAccount(keyring);
      expect(spy.calledOnce).toBe(true);
      expect(spyCallback.calledOnce).toBe(true);
    });

    it('restores unencrypted watch keyrings while locked', async () => {
      await addWatchAddress();
      await keyringService.setLocked();

      expect(keyringService.isUnlocked()).toBe(false);
      expect(keyringService.keyrings).toHaveLength(1);
      await expect(
        keyringService.getKeyringForAccount(
          TEST_ADDR,
          KEYRING_TYPE.WatchAddressKeyring,
        ),
      ).resolves.toBeTruthy();
    });

    it('does not duplicate unencrypted keyrings on repeated restore', async () => {
      await addWatchAddress();
      await keyringService.setLocked();
      await keyringService.restoreUnencryptedKeyrings();
      await keyringService.restoreUnencryptedKeyrings();

      const accounts = await keyringService.getAllVisibleAccountsArray();
      expect(keyringService.keyrings).toHaveLength(1);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].address).toBe(TEST_ADDR);
    });

    it('keeps a versioned public account snapshot for locked sensitive keyrings', async () => {
      setSensitiveHdKeyringInRuntime();
      await keyringService.persistAllKeyrings();
      await keyringService.setLocked();

      const snapshot = keyringService.store.getState().publicAccountSnapshot;
      const accounts = await keyringService.getAllVisibleAccountsArray();

      expect(snapshot?.version).toBe(4);
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual(
        expect.objectContaining({
          address: TEST_HD_ADDR,
          brandName: 'Rabby Wallet',
          hasBackup: true,
          needPassphrase: true,
          hdPathBasePublicKey: 'base-public-key',
          hdPathType: 'LedgerLive',
          hdPathIndex: 0,
        }),
      );
    });

    it('preserves locked sensitive vault data when updating password', async () => {
      const service = new KeyringService({
        encryptor: mockEncryptor as any,
        keyringClasses: [TestHdKeyring as any],
      });
      service.loadStore({});
      await service.boot(password);
      service.keyrings = [new TestHdKeyring() as any];
      await service.persistAllKeyrings();
      await service.setLocked();

      expect(service.isUnlocked()).toBe(false);
      expect(service.keyrings).toHaveLength(0);

      await service.updatePassword(password, 'new-password');

      expect(service.isUnlocked()).toBe(false);
      expect(service.store.getState().hasEncryptedKeyringData).toBe(true);

      await service.submitPassword('new-password');

      const accounts = await service.getAllVisibleAccountsArray();
      expect(accounts).toEqual([
        expect.objectContaining({
          address: TEST_HD_ADDR,
          brandName: 'Rabby Wallet',
          type: KEYRING_TYPE.HdKeyring,
        }),
      ]);
    });

    it('waits for deferred runtime restore when typed unencrypted keyring is not loaded', async () => {
      const service = new KeyringService({
        encryptor: mockEncryptor as any,
        keyringClasses: [
          TestHdKeyring as any,
          ...Object.values(keyringSdks),
        ] as any,
      });
      service.loadStore({});
      await service.boot(password);
      service.keyrings = [new TestHdKeyring() as any];

      const watchKeyring = await service.addNewKeyring(
        KEYRING_TYPE.WatchAddressKeyring as KeyringTypeName,
      );
      watchKeyring.setAccountToAdd(TEST_ADDR);
      await service.addNewAccount(watchKeyring);
      await service.setLocked();

      expect(service.isUnlocked()).toBe(false);
      expect(service.keyrings.map(keyring => keyring.type)).toEqual([
        KEYRING_TYPE.WatchAddressKeyring,
      ]);

      await service.submitPassword(password, {
        deferKeyringRuntimeRestore: true,
        deferMemStoreKeyringsUpdate: true,
      });

      expect(service.isUnlocked()).toBe(true);
      expect(service.isKeyringRuntimeReady()).toBe(false);
      expect(service.keyrings).toHaveLength(0);

      const keyring = await service.getKeyringForAccount(
        TEST_ADDR,
        KEYRING_TYPE.WatchAddressKeyring,
      );

      expect(keyring.type).toBe(KEYRING_TYPE.WatchAddressKeyring);
      expect(service.isKeyringRuntimeReady()).toBe(true);
      expect(service.memStore.getState().keyrings).toEqual([
        expect.objectContaining({
          type: KEYRING_TYPE.HdKeyring,
        }),
        expect.objectContaining({
          type: KEYRING_TYPE.WatchAddressKeyring,
          accounts: [
            expect.objectContaining({
              address: TEST_ADDR,
            }),
          ],
        }),
      ]);
    });

    it('ignores legacy public account snapshot versions', async () => {
      setSensitiveHdKeyringInRuntime();
      await keyringService.persistAllKeyrings();

      const snapshot = keyringService.store.getState().publicAccountSnapshot;
      keyringService.store.updateState({
        publicAccountSnapshot: {
          ...snapshot,
          version: 3,
          accounts: snapshot?.accounts.map(account => ({
            ...account,
            hdPathIndex: undefined,
          })),
        },
      } as any);
      await keyringService.setLocked();

      await expect(
        keyringService.getAllVisibleAccountsArray(),
      ).resolves.toEqual([]);
      expect(keyringService.hasPublicAccountSnapshot()).toBe(false);
    });

    it('preserves sensitive public snapshot when locked unencrypted keyrings change', async () => {
      setSensitiveHdKeyringInRuntime();
      await keyringService.persistAllKeyrings();
      await keyringService.setLocked();

      await addWatchAddress();

      const accounts = await keyringService.getAllVisibleAccountsArray();
      const snapshot = keyringService.store.getState().publicAccountSnapshot;

      expect(snapshot?.accounts.map(item => item.address).sort()).toEqual(
        [TEST_HD_ADDR, TEST_ADDR].sort(),
      );
      expect(accounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            address: TEST_HD_ADDR,
            brandName: 'Rabby Wallet',
          }),
          expect.objectContaining({
            address: TEST_ADDR,
          }),
        ]),
      );
    });

    it('rejects locked sensitive addKeyring before mutating runtime', async () => {
      await keyringService.setLocked();

      const getAccounts = sinon.spy(async () => [TEST_HD_ADDR]);
      const hdKeyring = {
        type: KEYRING_TYPE.HdKeyring,
        getAccounts,
      };

      await expect(keyringService.addKeyring(hdKeyring as any)).rejects.toThrow(
        'background.error.unlock',
      );
      expect(getAccounts.called).toBe(false);
      expect(keyringService.keyrings).toHaveLength(0);
    });

    it('rejects locked sensitive addNewAccount before mutating keyring', async () => {
      await keyringService.setLocked();

      const addAccounts = sinon.spy(async () => [TEST_HD_ADDR]);
      const hdKeyring = {
        type: KEYRING_TYPE.HdKeyring,
        addAccounts,
      };

      await expect(
        keyringService.addNewAccount(hdKeyring as any),
      ).rejects.toThrow('background.error.unlock');
      expect(addAccounts.called).toBe(false);
      expect(keyringService.keyrings).toHaveLength(0);
    });

    it('rejects locked extension sync before touching vault data', async () => {
      await keyringService.setLocked();

      await expect(keyringService.syncExtensionData([])).rejects.toThrow(
        'background.error.unlock',
      );
    });

    it('returns transferred accounts and emits only newly added accounts', async () => {
      await addWatchAddress(TEST_ADDR);

      const spy = sinon.spy();
      keyringService.on('newAccount', spy);

      const { addedAccounts, transferredAccounts } =
        await keyringService.syncExtensionData([
          {
            type: KEYRING_TYPE.WatchAddressKeyring,
            data: { accounts: [TEST_ADDR, TEST_ADDR_2] },
          },
        ]);

      expect(addedAccounts).toStrictEqual([
        expect.objectContaining({
          address: TEST_ADDR_2,
          brandName: KEYRING_TYPE.WatchAddressKeyring,
          type: KEYRING_TYPE.WatchAddressKeyring,
        }),
      ]);
      expect(transferredAccounts).toStrictEqual([
        expect.objectContaining({
          address: TEST_ADDR,
          type: KEYRING_TYPE.WatchAddressKeyring,
        }),
        expect.objectContaining({
          address: TEST_ADDR_2,
          type: KEYRING_TYPE.WatchAddressKeyring,
        }),
      ]);
      expect(spy.calledOnceWithExactly(addedAccounts[0])).toBe(true);

      const accounts = await keyringService.getAllVisibleAccountsArray();
      expect(accounts.map(account => account.address)).toStrictEqual([
        TEST_ADDR,
        TEST_ADDR_2,
      ]);
    });

    it.each([
      ['non-array payload', {} as any, 'Invalid wallet transfer data'],
      ['empty payload', [], 'Invalid wallet transfer data'],
      [
        'oversized payload',
        Array.from({ length: 1001 }, () => ({
          type: KEYRING_TYPE.WatchAddressKeyring,
          data: { accounts: [] },
        })),
        'Invalid wallet transfer data',
      ],
      [
        'missing keyring data',
        [{ type: KEYRING_TYPE.WatchAddressKeyring, data: null }],
        'Unsupported wallet transfer data',
      ],
      [
        'unsupported keyring type',
        [{ type: KEYRING_TYPE.WalletConnectKeyring, data: { accounts: [] } }],
        'Unsupported wallet transfer data',
      ],
    ] as [string, any, string][])(
      'rejects %s before mutating keyrings',
      async (_name, payload, errorMessage) => {
        const runtimeKeyrings = keyringService.keyrings;
        const storedVault = keyringService.store.getState().vault;

        await expect(keyringService.syncExtensionData(payload)).rejects.toThrow(
          errorMessage,
        );

        expect(keyringService.keyrings).toBe(runtimeKeyrings);
        expect(keyringService.store.getState().vault).toBe(storedVault);
      },
    );

    it('fills HD accounts from accountDetails when the export omits accounts', async () => {
      const service = new KeyringService({
        encryptor: mockEncryptor as any,
        keyringClasses: [TestHdKeyring as any],
      });
      service.loadStore({});
      await service.boot(password);
      await service.clearKeyrings();

      const result = await service.syncExtensionData([
        {
          type: KEYRING_TYPE.HdKeyring,
          data: {
            mnemonic: walletOneSeedWords,
            accountDetails: {
              [TEST_HD_ADDR]: { index: 0 },
            },
          },
        },
      ]);

      expect(result.addedAccounts).toStrictEqual([
        expect.objectContaining({
          address: TEST_HD_ADDR,
          brandName: 'Rabby Wallet',
          type: KEYRING_TYPE.HdKeyring,
        }),
      ]);
      expect(result.transferredAccounts).toStrictEqual(result.addedAccounts);
    });

    it('validates the complete merged vault before mutating runtime state', async () => {
      class MergeLimitedWatchKeyring {
        static type = KEYRING_TYPE.WatchAddressKeyring;

        type = KEYRING_TYPE.WatchAddressKeyring;

        accounts: string[] = [];

        async serialize() {
          return { accounts: this.accounts };
        }

        async deserialize(data: { accounts?: string[] }) {
          const accounts = data.accounts || [];
          if (accounts.length > 1) {
            throw new Error('merged vault is invalid');
          }
          this.accounts = accounts;
        }

        async getAccounts() {
          return this.accounts;
        }
      }

      const service = new KeyringService({
        encryptor: mockEncryptor as any,
        keyringClasses: [MergeLimitedWatchKeyring as any],
      });
      service.loadStore({});
      await service.boot(password);
      const currentKeyring = new MergeLimitedWatchKeyring();
      await currentKeyring.deserialize({ accounts: [TEST_ADDR] });
      service.keyrings = [currentKeyring as any];
      await service.persistAllKeyrings();
      const storedVault = service.store.getState().vault;
      const spy = sinon.spy();
      service.on('newAccount', spy);

      await expect(
        service.syncExtensionData([
          {
            type: KEYRING_TYPE.WatchAddressKeyring,
            data: { accounts: [TEST_ADDR_2] },
          },
        ]),
      ).rejects.toThrow('merged vault is invalid');

      expect(service.keyrings).toStrictEqual([currentKeyring]);
      expect(service.store.getState().vault).toBe(storedVault);
      expect(spy.called).toBe(false);
    });

    it('rolls back runtime and persisted vault when mutation fails', async () => {
      await addWatchAddress(TEST_ADDR);
      const storedVault = keyringService.store.getState().vault;
      const spy = sinon.spy();
      keyringService.on('newAccount', spy);
      sinon
        .stub(keyringService, 'persistAllKeyrings')
        .rejects(new Error('persist failed'));

      await expect(
        keyringService.syncExtensionData([
          {
            type: KEYRING_TYPE.WatchAddressKeyring,
            data: { accounts: [TEST_ADDR_2] },
          },
        ]),
      ).rejects.toThrow('persist failed');

      expect(keyringService.store.getState().vault).toBe(storedVault);
      expect(keyringService.isKeyringRuntimeReady()).toBe(true);
      expect(spy.called).toBe(false);
      const accounts = await keyringService.getAllVisibleAccountsArray();
      expect(accounts).toStrictEqual([
        expect.objectContaining({
          address: TEST_ADDR,
          type: KEYRING_TYPE.WatchAddressKeyring,
        }),
      ]);
    });

    it('rejects locked private key export', async () => {
      await keyringService.setLocked();

      await expect(keyringService.exportAccount(TEST_HD_ADDR)).rejects.toThrow(
        'background.error.unlock',
      );
    });
  });
});
