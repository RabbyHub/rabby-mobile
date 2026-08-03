import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_TYPE,
  type KeyringAccount,
  type KeyringTypeName,
} from '@rabby-wallet/keyring-utils';

import mockEncryptor from '../test/mock-encryptor';
import { KeyringService } from './keyringService';
import { passwordDecrypt } from './utils/password';

const PASSWORD = 'wallet-password';
const HD_ADDRESS_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HD_ADDRESS_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const WATCH_ADDRESS_A = '0xcccccccccccccccccccccccccccccccccccccccc';
const WATCH_ADDRESS_B = '0xdddddddddddddddddddddddddddddddddddddddd';
const KEYSTONE_ADDRESS_A = '0x1111111111111111111111111111111111111111';
const KEYSTONE_ADDRESS_B = '0x2222222222222222222222222222222222222222';

const selectedAccount = (
  type: KEYRING_TYPE,
  address: string,
  brandName: string = type,
) =>
  ({
    type: type as KeyringTypeName,
    address,
    brandName,
  } as Pick<KeyringAccount, 'address' | 'type' | 'brandName'>);

const createKeyring = ({
  type,
  accounts,
  data,
  isSlip39,
  needPassphrase,
}: {
  type: KEYRING_TYPE;
  accounts: string[];
  data: any;
  isSlip39?: boolean;
  needPassphrase?: boolean;
}) =>
  ({
    type,
    isSlip39,
    needPassphrase,
    getAccounts: jest.fn(async () => accounts),
    serialize: jest.fn(async () => data),
  } as any);

const createUnlockedService = async () => {
  const service = new KeyringService({ encryptor: mockEncryptor as any });
  service.loadStore({});
  await service.boot(PASSWORD);
  await service.clearKeyrings();
  return service;
};

describe('KeyringService#getSyncVault', () => {
  it('exports only matching type/address data using a browser-passworder compatible vault', async () => {
    const service = await createUnlockedService();
    service.keyrings = [
      createKeyring({
        type: KEYRING_TYPE.HdKeyring,
        accounts: [HD_ADDRESS_A, HD_ADDRESS_B],
        data: {
          mnemonic: 'test mnemonic',
          accounts: [HD_ADDRESS_A, HD_ADDRESS_B],
          accountDetails: {
            [HD_ADDRESS_A]: { index: 0 },
            [HD_ADDRESS_B]: { index: 1 },
          },
          publicKey: 'hd-public-key',
          activeIndexes: [0, 1],
          byImport: true,
          isSlip39: false,
          needPassphrase: false,
        },
      }),
      createKeyring({
        type: KEYRING_TYPE.WatchAddressKeyring,
        accounts: [WATCH_ADDRESS_A, WATCH_ADDRESS_B],
        data: {
          accounts: [WATCH_ADDRESS_A, WATCH_ADDRESS_B],
          addressDetails: {
            [WATCH_ADDRESS_A]: { name: 'watch-a' },
            [WATCH_ADDRESS_B]: { name: 'watch-b' },
          },
          metadata: { source: 'watch' },
        },
      }),
      createKeyring({
        type: KEYRING_TYPE.KeystoneKeyring,
        accounts: [KEYSTONE_ADDRESS_A, KEYSTONE_ADDRESS_B],
        data: {
          name: 'Keystone',
          keyringMode: 'pubkey',
          accounts: [KEYSTONE_ADDRESS_A, KEYSTONE_ADDRESS_B],
          paths: {
            [KEYSTONE_ADDRESS_A]: "m/44'/60'/0'/0/0",
            [KEYSTONE_ADDRESS_B]: "m/44'/60'/0'/0/1",
          },
          indexes: {
            [KEYSTONE_ADDRESS_A]: 0,
            [KEYSTONE_ADDRESS_B]: 1,
          },
          accountDetails: {
            [KEYSTONE_ADDRESS_A]: { index: 0 },
            [KEYSTONE_ADDRESS_B]: { index: 1 },
          },
        },
      }),
      createKeyring({
        type: KEYRING_TYPE.SimpleKeyring,
        accounts: [HD_ADDRESS_B],
        data: ['private-key-for-the-same-address'],
      }),
    ];

    const { vault, accounts } = await service.getSyncVault([
      selectedAccount(
        KEYRING_TYPE.HdKeyring,
        `0x${HD_ADDRESS_B.slice(2).toUpperCase()}`,
      ),
      selectedAccount(KEYRING_TYPE.WatchAddressKeyring, WATCH_ADDRESS_A),
      selectedAccount(
        KEYRING_TYPE.KeystoneKeyring,
        KEYSTONE_ADDRESS_B,
        HARDWARE_KEYRING_TYPES.Keystone.brandName,
      ),
    ]);
    const decrypted = await passwordDecrypt({
      encryptedData: vault,
      password: PASSWORD,
    });

    expect(accounts).toStrictEqual([
      HD_ADDRESS_B,
      WATCH_ADDRESS_A,
      KEYSTONE_ADDRESS_B,
    ]);
    expect(decrypted).toStrictEqual([
      {
        type: KEYRING_TYPE.HdKeyring,
        data: {
          mnemonic: 'test mnemonic',
          accountDetails: {
            [HD_ADDRESS_B]: { index: 1 },
          },
          publicKey: 'hd-public-key',
        },
      },
      {
        type: KEYRING_TYPE.WatchAddressKeyring,
        data: {
          accounts: [WATCH_ADDRESS_A],
          addressDetails: {
            [WATCH_ADDRESS_A]: { name: 'watch-a' },
          },
          metadata: { source: 'watch' },
        },
      },
      {
        type: KEYRING_TYPE.KeystoneKeyring,
        data: {
          name: 'Keystone',
          keyringMode: 'pubkey',
          accounts: [KEYSTONE_ADDRESS_B],
          paths: {
            [KEYSTONE_ADDRESS_A]: "m/44'/60'/0'/0/0",
            [KEYSTONE_ADDRESS_B]: "m/44'/60'/0'/0/1",
          },
          indexes: {
            [KEYSTONE_ADDRESS_A]: 0,
            [KEYSTONE_ADDRESS_B]: 1,
          },
          accountDetails: {
            [KEYSTONE_ADDRESS_B]: { index: 1 },
          },
        },
      },
    ]);

    await expect(
      passwordDecrypt({ encryptedData: vault, password: 'wrong-password' }),
    ).rejects.toThrow('Incorrect password');
  });

  it('keeps array serialization unchanged while still matching by account type', async () => {
    const service = await createUnlockedService();
    const privateKeys = ['private-key-a', 'private-key-b'];
    service.keyrings = [
      createKeyring({
        type: KEYRING_TYPE.SimpleKeyring,
        accounts: [HD_ADDRESS_A, HD_ADDRESS_B],
        data: privateKeys,
      }),
      createKeyring({
        type: KEYRING_TYPE.WatchAddressKeyring,
        accounts: [HD_ADDRESS_A],
        data: { accounts: [HD_ADDRESS_A] },
      }),
    ];

    const { vault, accounts } = await service.getSyncVault([
      selectedAccount(KEYRING_TYPE.SimpleKeyring, HD_ADDRESS_A),
    ]);
    const decrypted = await passwordDecrypt({
      encryptedData: vault,
      password: PASSWORD,
    });

    expect(accounts).toStrictEqual([HD_ADDRESS_A]);
    expect(decrypted).toStrictEqual([
      { type: KEYRING_TYPE.SimpleKeyring, data: privateKeys },
    ]);
  });

  it.each([
    ['SLIP-39', { isSlip39: true }, 'SLIP-39 mnemonic keyrings'],
    [
      'passphrase',
      { needPassphrase: true },
      'Mnemonic keyrings with a passphrase',
    ],
  ])('rejects selected %s mnemonic keyrings', async (_name, flags, message) => {
    const service = await createUnlockedService();
    service.keyrings = [
      createKeyring({
        type: KEYRING_TYPE.HdKeyring,
        accounts: [HD_ADDRESS_A],
        ...flags,
        data: {
          mnemonic: 'restricted mnemonic',
          accountDetails: { [HD_ADDRESS_A]: { index: 0 } },
          publicKey: 'restricted-public-key',
          ...flags,
        },
      }),
    ];

    await expect(
      service.getSyncVault([
        selectedAccount(KEYRING_TYPE.HdKeyring, HD_ADDRESS_A),
      ]),
    ).rejects.toThrow(message);
  });

  it('does not let an unselected restricted mnemonic block other exports', async () => {
    const service = await createUnlockedService();
    service.keyrings = [
      createKeyring({
        type: KEYRING_TYPE.HdKeyring,
        accounts: [HD_ADDRESS_A],
        data: {
          mnemonic: 'restricted mnemonic',
          accountDetails: { [HD_ADDRESS_A]: { index: 0 } },
          isSlip39: true,
        },
      }),
      createKeyring({
        type: KEYRING_TYPE.WatchAddressKeyring,
        accounts: [WATCH_ADDRESS_A],
        data: { accounts: [WATCH_ADDRESS_A] },
      }),
    ];

    const { vault } = await service.getSyncVault([
      selectedAccount(KEYRING_TYPE.WatchAddressKeyring, WATCH_ADDRESS_A),
    ]);

    const decrypted = await passwordDecrypt({
      encryptedData: vault,
      password: PASSWORD,
    });
    expect(decrypted).toStrictEqual([
      {
        type: KEYRING_TYPE.WatchAddressKeyring,
        data: { accounts: [WATCH_ADDRESS_A] },
      },
    ]);
  });

  it('rejects QR hardware accounts whose brand is not Keystone', async () => {
    const service = await createUnlockedService();
    service.keyrings = [
      createKeyring({
        type: KEYRING_TYPE.KeystoneKeyring,
        accounts: [KEYSTONE_ADDRESS_A],
        data: { accounts: [KEYSTONE_ADDRESS_A] },
      }),
    ];

    await expect(
      service.getSyncVault([
        selectedAccount(
          KEYRING_TYPE.KeystoneKeyring,
          KEYSTONE_ADDRESS_A,
          'OneKey',
        ),
      ]),
    ).rejects.toThrow('Only Keystone accounts can be exported');
  });

  it('reports per-address HD export restrictions from runtime keyrings', async () => {
    const service = await createUnlockedService();
    service.keyrings = [
      createKeyring({
        type: KEYRING_TYPE.HdKeyring,
        accounts: [HD_ADDRESS_A, HD_ADDRESS_B],
        data: { isSlip39: true },
        isSlip39: false,
        needPassphrase: false,
      }),
      createKeyring({
        type: KEYRING_TYPE.WatchAddressKeyring,
        accounts: [WATCH_ADDRESS_A],
        data: {},
      }),
    ];

    const restrictions = await service.getSyncExportAccountRestrictions();
    expect(restrictions).toStrictEqual([
      {
        address: HD_ADDRESS_A,
        type: KEYRING_TYPE.HdKeyring,
        isSlip39: true,
        needPassphrase: false,
      },
      {
        address: HD_ADDRESS_B,
        type: KEYRING_TYPE.HdKeyring,
        isSlip39: true,
        needPassphrase: false,
      },
    ]);
  });

  it('requires the wallet to be unlocked', async () => {
    const service = new KeyringService({ encryptor: mockEncryptor as any });
    service.loadStore({});

    await expect(service.getSyncVault([])).rejects.toThrow(
      'background.error.unlock',
    );
  });
});
