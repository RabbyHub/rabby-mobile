import * as sinon from 'sinon';
import { KeyringService } from '../src/keyringService';
import mockEncryptor from '../test/mock-encryptor';
import { KEYRING_TYPE, KeyringTypeName } from '@rabby-wallet/keyring-utils';

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
  const TEST_HD_ADDR = '0x1111111111111111111111111111111111111111';

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

      await expect(keyringService.getAllVisibleAccountsArray()).resolves.toEqual(
        [],
      );
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

    it('emits one newAccount signal after extension sync adds addresses', async () => {
      await keyringService.persistAllKeyrings();

      const sourceKeyringService = new KeyringService({
        encryptor: mockEncryptor as any,
      });
      sourceKeyringService.loadStore({});
      await sourceKeyringService.boot(password);
      await sourceKeyringService.clearKeyrings();
      const sourceKeyring = await sourceKeyringService.addNewKeyring(
        KEYRING_TYPE.WatchAddressKeyring as KeyringTypeName,
      );
      sourceKeyring.setAccountToAdd(TEST_ADDR);
      await sourceKeyringService.addNewAccount(sourceKeyring);
      await sourceKeyringService.persistAllKeyrings();

      const spy = sinon.spy();
      keyringService.on('newAccount', spy);

      const addedAccounts = await keyringService.syncExtensionData(
        sourceKeyringService.store.getState().vault as any,
      );

      expect(addedAccounts).toEqual([
        expect.objectContaining({
          address: TEST_ADDR,
          brandName: KEYRING_TYPE.WatchAddressKeyring,
          type: KEYRING_TYPE.WatchAddressKeyring,
        }),
      ]);
      expect(spy.calledOnceWithExactly(addedAccounts[0])).toBe(true);
    });

    it('rejects locked private key export', async () => {
      await keyringService.setLocked();

      await expect(keyringService.exportAccount(TEST_HD_ADDR)).rejects.toThrow(
        'background.error.unlock',
      );
    });
  });
});
