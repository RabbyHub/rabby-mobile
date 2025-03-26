import {
  KEYRING_TYPE,
  type KeyringSerializedData,
} from '@rabby-wallet/keyring-utils';

import * as testData1 from '../../test/mergeValut.data1';
import { mergeVault } from './mergeVault';

describe('mergeVault', () => {
  it('shoould overwrite empty vault', () => {
    const origin = [] as KeyringSerializedData[];

    const merge = [
      {
        type: KEYRING_TYPE.SimpleKeyring,
        data: ['0x456'],
      },
    ];

    const result = mergeVault(origin, merge);
    expect(result).toStrictEqual([
      { type: KEYRING_TYPE.SimpleKeyring, data: ['0x456'] },
    ]);
  });

  it('should merge simple keyrings with unique private keys', () => {
    const origin = [
      {
        type: KEYRING_TYPE.SimpleKeyring,
        data: ['0x123'],
      },
    ];

    const merge = [
      {
        type: KEYRING_TYPE.SimpleKeyring,
        data: ['0x456'],
      },
    ];

    const result = mergeVault(origin, merge);
    expect(result).toStrictEqual([
      { type: KEYRING_TYPE.SimpleKeyring, data: ['0x123'] },
      { type: KEYRING_TYPE.SimpleKeyring, data: ['0x456'] },
    ]);
  });

  it('should not duplicate existing simple keyring private keys', () => {
    const origin = [
      {
        type: KEYRING_TYPE.SimpleKeyring,
        data: ['0x123'],
      },
    ];

    const merge = [
      {
        type: KEYRING_TYPE.SimpleKeyring,
        data: ['0x123'],
      },
    ];

    const result = mergeVault(origin, merge);
    expect(result).toStrictEqual([
      {
        type: KEYRING_TYPE.SimpleKeyring,
        data: ['0x123'],
      },
    ]);
  });
  it('should not merge HD keyring accounts with same address in different case', () => {
    const origin = [
      {
        type: KEYRING_TYPE.HdKeyring,
        data: {
          mnemonic: 'test mnemonic',
          accounts: ['0xABC123'],
          accountDetails: {
            '0xABC123': {
              hdPath: "m/44'/60'/0'/0",
              hdPathType: 'BIP44',
              index: 0,
            },
          },
        },
      },
    ];

    const merge = [
      {
        type: KEYRING_TYPE.HdKeyring,
        data: {
          mnemonic: 'test mnemonic',
          accounts: ['0xabc123'],
          accountDetails: {
            '0xABC123': {
              hdPath: "m/44'/60'/0'/0",
              hdPathType: 'BIP44',
              index: 0,
            },
          },
        },
      },
    ];

    const result = mergeVault(origin, merge);
    expect(result).toStrictEqual([
      {
        type: KEYRING_TYPE.HdKeyring,
        data: {
          mnemonic: 'test mnemonic',
          accounts: ['0xABC123'],
          accountDetails: {
            '0xABC123': {
              hdPath: "m/44'/60'/0'/0",
              hdPathType: 'BIP44',
              index: 0,
            },
          },
        },
      },
    ]);
  });

  it('should merge HD keyrings and combine accounts', () => {
    const origin = [
      {
        type: KEYRING_TYPE.HdKeyring,
        data: {
          mnemonic: 'test mnemonic',
          accounts: ['0x123'],
          accountDetails: {
            '0x123': {
              hdPath: "m/44'/60'/0'/0",
              hdPathType: 'BIP44',
              index: 0,
            },
          },
        },
      },
    ];

    const merge = [
      {
        type: KEYRING_TYPE.HdKeyring,
        data: {
          mnemonic: 'test mnemonic',
          accounts: ['0x456'],
          accountDetails: {
            '0x456': {
              hdPath: "m/44'/60'/0'/0",
              hdPathType: 'BIP44',
              index: 1,
            },
          },
        },
      },
    ];

    const result = mergeVault(origin, merge);
    expect(result).toStrictEqual([
      {
        type: KEYRING_TYPE.HdKeyring,
        data: {
          mnemonic: 'test mnemonic',
          accounts: ['0x123', '0x456'],
          accountDetails: {
            '0x123': {
              hdPath: "m/44'/60'/0'/0",
              hdPathType: 'BIP44',
              index: 0,
            },
            '0x456': {
              hdPath: "m/44'/60'/0'/0",
              hdPathType: 'BIP44',
              index: 1,
            },
          },
        },
      },
    ]);
  });

  it('should merge non-unique keyring types by replacing', () => {
    const origin = [
      {
        type: KEYRING_TYPE.OneKeyKeyring,
        data: {
          accounts: ['0xbAE81CD98dC4bb7D03E65f1Cd668a641F0661519'],
          mnemonic: 'purse disorder',
          activeIndexes: [0],
          hdPath: "m/44'/60'/0'/0",
          byImport: true,
          index: 0,
          needPassphrase: false,
          page: 0,
          perPage: 5,
          unlockedAccount: 0,
          accountDetails: {
            '0xbAE81CD98dC4bb7D03E65f1Cd668a641F0661519': {
              hdPath: "m/44'/60'/0'/0/2",
              hdPathType: 'BIP44',
              hdPathBasePublicKey: '03b782d2',
              index: 2,
            },
          },
        },
      },
    ];

    const merge = [
      {
        type: KEYRING_TYPE.OneKeyKeyring,
        data: {
          accounts: ['0xaAE81CD98dC4bb7D03E65f1Cd668a641F0661519'],
          accountDetails: {
            '0xaAE81CD98dC4bb7D03E65f1Cd668a641F0661519': {
              hdPath: "m/44'/60'/0'/0/2",
              hdPathType: 'BIP44',
              hdPathBasePublicKey: '03b782d2',
              index: 1,
            },
          },
        },
      },
    ];

    const result = mergeVault(origin, merge);
    expect(result).toStrictEqual([
      {
        type: KEYRING_TYPE.OneKeyKeyring,
        data: {
          accounts: [
            '0xbAE81CD98dC4bb7D03E65f1Cd668a641F0661519',
            '0xaAE81CD98dC4bb7D03E65f1Cd668a641F0661519',
          ],
          mnemonic: 'purse disorder',
          activeIndexes: [0],
          hdPath: "m/44'/60'/0'/0",
          byImport: true,
          index: 0,
          needPassphrase: false,
          page: 0,
          perPage: 5,
          unlockedAccount: 0,
          accountDetails: {
            '0xbAE81CD98dC4bb7D03E65f1Cd668a641F0661519': {
              hdPath: "m/44'/60'/0'/0/2",
              hdPathType: 'BIP44',
              hdPathBasePublicKey: '03b782d2',
              index: 2,
            },
            '0xaAE81CD98dC4bb7D03E65f1Cd668a641F0661519': {
              hdPath: "m/44'/60'/0'/0/2",
              hdPathType: 'BIP44',
              hdPathBasePublicKey: '03b782d2',
              index: 1,
            },
          },
        },
      },
    ]);
  });

  it('test data1', () => {
    const result = mergeVault(testData1.oldVault, testData1.newVault);
    expect(result).toStrictEqual(testData1.expectVault);
  });
});
