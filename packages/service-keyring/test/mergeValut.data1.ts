import { type KeyringSerializedData } from '@rabby-wallet/keyring-utils';

export const oldVault = [
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'purse disorder',
      activeIndexes: [0],
      hdPath: "m/44'/60'/0'/0",
      byImport: true,
      index: 0,
      needPassphrase: false,
      accounts: ['0x2160e08a3819d83bd787f7494ea1401a9b6caa1b'],
      accountDetails: {
        '0x2160e08a3819d83bd787f7494ea1401a9b6caa1b': {
          hdPath: "m/44'/60'/0'/0",
          hdPathType: 'BIP44',
          index: 0,
        },
      },
      publicKey: '0x02934',
      isSlip39: false,
    },
  },
  {
    type: 'Onekey Hardware',
    data: {
      hdPath: "m/44'/60'/0'/0",
      accounts: [],
      page: 0,
      paths: {},
      perPage: 5,
      unlockedAccount: 0,
      accountDetails: {},
    },
  },
  { type: 'Simple Key Pair', data: ['2f59b53f2'] },
] as KeyringSerializedData[];

export const newVault = [
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'level  car',
      accountDetails: {},
      publicKey: '3075',
      accounts: [],
    },
  },
  {
    type: 'Simple Key Pair',
    data: ['0137b'],
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'gorilla latin',
      accountDetails: {},
      publicKey: '0x03a17',
      accounts: [],
    },
  },
  {
    type: 'Simple Key Pair',
    data: ['2f59b'],
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'chest venue',
      accountDetails: {},
      publicKey: '0x03a7',
      accounts: [],
    },
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'budget vehicle',
      accountDetails: {
        '0xbd8d38ccae4ec568d787dd5e4f4c7408f7337e0b': {
          hdPath: "m/44'/60'/0'/0",
          hdPathType: 'BIP44',
          index: 2,
        },
      },
      publicKey: '0x03685',
      accounts: ['0xbd8d38ccae4ec568d787dd5e4f4c7408f7337e0b'],
    },
  },
  {
    type: 'Simple Key Pair',
    data: ['5f97'],
  },
  {
    type: 'Ledger Hardware',
    data: {
      hdPath: "m/44'/60'/0'/0/0",
      accounts: ['0x5b111702d695435d175e2d7fe5a8d7df32137353'],
      accountDetails: {
        '0x5b111702d695435d175E2d7fE5A8d7DF32137353': {
          hdPath: "m/44'/60'/0'/0/0",
          hdPathBasePublicKey: '04eebf1b',
          hdPathType: 'LedgerLive',
        },
      },
      hasHIDPermission: null,
      usedHDPathTypeList: {},
    },
  },
  {
    type: 'Simple Key Pair',
    data: ['2789'],
  },
  {
    type: 'Simple Key Pair',
    data: ['5da5'],
  },
  {
    type: 'Simple Key Pair',
    data: ['bee0'],
  },
  {
    type: 'Simple Key Pair',
    data: ['e154e'],
  },
  {
    type: 'Simple Key Pair',
    data: ['23d2'],
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'purse disorder',
      accountDetails: {
        '0x2160e08a3819d83bd787f7494ea1401a9b6caa1b': {
          hdPath: "m/44'/60'/0'/0",
          hdPathType: 'BIP44',
          index: 0,
        },
      },
      publicKey: '0x02934',
      accounts: ['0x2160e08a3819d83bd787f7494ea1401a9b6caa1b'],
    },
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'inner cook',
      accountDetails: {},
      publicKey: '0x022e',
      accounts: [],
    },
  },
  {
    type: 'Onekey Hardware',
    data: {
      hdPath: "m/44'/60'/0'/0",
      accounts: ['0xaAE81CD98dC4bb7D03E65f1Cd668a641F0661519'],
      page: 0,
      paths: {
        '0xaAE8': 2,
        '0x6484': 4,
        '0x544D': 5,
        '0xe5D8': 6,
        '0xA4E8': 7,
        '0x3f67': 8,
        '0xE419': 9,
        '0xBbE7': 10,
        '0xa567': 11,
        '0x5d7A': 12,
        '0xF30A': 13,
        '0x0BD5': 14,
        '0x4269': 15,
        '0xBe71': 16,
        '0x2548': 17,
        '0xb746': 18,
        '0xb88e': 19,
        '0xFFc7': 20,
        '0xe303': 21,
        '0x2A3F': 22,
        '0x184e': 23,
        '0xb9Cc': 24,
        '0xcD34': 25,
        '0x5Ce4': 26,
        '0xaf08': 27,
        '0xA8Ea': 28,
        '0x1C15': 29,
        '0xF925': 30,
        '0x7f12': 31,
        '0xB554': 32,
        '0xD62E': 33,
        '0x6f8D': 34,
        '0x920c': 35,
        '0x22D3': 36,
        '0x0745': 37,
        '0x07A3': 38,
        '0x9bC7': 39,
        '0x6Bfe': 40,
        '0xD421': 41,
        '0x747d': 42,
        '0xa49a': 43,
        '0xA71C': 44,
        '0xEA43': 45,
        '0xe876': 46,
        '0xEc67': 47,
        '0xFD10': 48,
        '0x6Ca4': 49,
      },
      perPage: 5,
      unlockedAccount: 0,
      accountDetails: {
        '0xaAE81CD98dC4bb7D03E65f1Cd668a641F0661519': {
          hdPath: "m/44'/60'/0'/0/2",
          hdPathType: 'BIP44',
          hdPathBasePublicKey: '03b782d2',
          index: 2,
        },
      },
    },
  },
] as KeyringSerializedData[];

export const expectVault = [
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'purse disorder',
      activeIndexes: [0],
      hdPath: "m/44'/60'/0'/0",
      byImport: true,
      index: 0,
      needPassphrase: false,
      accounts: ['0x2160e08a3819d83bd787f7494ea1401a9b6caa1b'],
      accountDetails: {
        '0x2160e08a3819d83bd787f7494ea1401a9b6caa1b': {
          hdPath: "m/44'/60'/0'/0",
          hdPathType: 'BIP44',
          index: 0,
        },
      },
      publicKey: '0x02934',
      isSlip39: false,
    },
  },
  {
    type: 'Onekey Hardware',
    data: {
      hdPath: "m/44'/60'/0'/0",
      accounts: ['0xaAE81CD98dC4bb7D03E65f1Cd668a641F0661519'],
      page: 0,
      paths: {
        '0xaAE8': 2,
        '0x6484': 4,
        '0x544D': 5,
        '0xe5D8': 6,
        '0xA4E8': 7,
        '0x3f67': 8,
        '0xE419': 9,
        '0xBbE7': 10,
        '0xa567': 11,
        '0x5d7A': 12,
        '0xF30A': 13,
        '0x0BD5': 14,
        '0x4269': 15,
        '0xBe71': 16,
        '0x2548': 17,
        '0xb746': 18,
        '0xb88e': 19,
        '0xFFc7': 20,
        '0xe303': 21,
        '0x2A3F': 22,
        '0x184e': 23,
        '0xb9Cc': 24,
        '0xcD34': 25,
        '0x5Ce4': 26,
        '0xaf08': 27,
        '0xA8Ea': 28,
        '0x1C15': 29,
        '0xF925': 30,
        '0x7f12': 31,
        '0xB554': 32,
        '0xD62E': 33,
        '0x6f8D': 34,
        '0x920c': 35,
        '0x22D3': 36,
        '0x0745': 37,
        '0x07A3': 38,
        '0x9bC7': 39,
        '0x6Bfe': 40,
        '0xD421': 41,
        '0x747d': 42,
        '0xa49a': 43,
        '0xA71C': 44,
        '0xEA43': 45,
        '0xe876': 46,
        '0xEc67': 47,
        '0xFD10': 48,
        '0x6Ca4': 49,
      },
      perPage: 5,
      unlockedAccount: 0,
      accountDetails: {
        '0xaAE81CD98dC4bb7D03E65f1Cd668a641F0661519': {
          hdPath: "m/44'/60'/0'/0/2",
          hdPathType: 'BIP44',
          hdPathBasePublicKey: '03b782d2',
          index: 2,
        },
      },
    },
  },
  { type: 'Simple Key Pair', data: ['2f59b53f2'] },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'level  car',
      accountDetails: {},
      publicKey: '3075',
      accounts: [],
    },
  },
  {
    type: 'Simple Key Pair',
    data: ['0137b'],
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'gorilla latin',
      accountDetails: {},
      publicKey: '0x03a17',
      accounts: [],
    },
  },
  {
    type: 'Simple Key Pair',
    data: ['2f59b'],
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'chest venue',
      accountDetails: {},
      publicKey: '0x03a7',
      accounts: [],
    },
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'budget vehicle',
      accountDetails: {
        '0xbd8d38ccae4ec568d787dd5e4f4c7408f7337e0b': {
          hdPath: "m/44'/60'/0'/0",
          hdPathType: 'BIP44',
          index: 2,
        },
      },
      publicKey: '0x03685',
      accounts: ['0xbd8d38ccae4ec568d787dd5e4f4c7408f7337e0b'],
    },
  },
  {
    type: 'Simple Key Pair',
    data: ['5f97'],
  },
  {
    type: 'Ledger Hardware',
    data: {
      hdPath: "m/44'/60'/0'/0/0",
      accounts: ['0x5b111702d695435d175e2d7fe5a8d7df32137353'],
      accountDetails: {
        '0x5b111702d695435d175E2d7fE5A8d7DF32137353': {
          hdPath: "m/44'/60'/0'/0/0",
          hdPathBasePublicKey: '04eebf1b',
          hdPathType: 'LedgerLive',
        },
      },
      hasHIDPermission: null,
      usedHDPathTypeList: {},
    },
  },
  {
    type: 'Simple Key Pair',
    data: ['2789'],
  },
  {
    type: 'Simple Key Pair',
    data: ['5da5'],
  },
  {
    type: 'Simple Key Pair',
    data: ['bee0'],
  },
  {
    type: 'Simple Key Pair',
    data: ['e154e'],
  },
  {
    type: 'Simple Key Pair',
    data: ['23d2'],
  },
  {
    type: 'HD Key Tree',
    data: {
      mnemonic: 'inner cook',
      accountDetails: {},
      publicKey: '0x022e',
      accounts: [],
    },
  },
] as KeyringSerializedData[];
