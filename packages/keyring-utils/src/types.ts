export enum KEYRING_TYPE {
  // SimpleKeyring = 'Simple Key Pair',
  // HdKeyring = 'HD Key Tree',
  // HardwareKeyring = 'hardware',
  WatchAddressKeyring = 'Watch Address',
  WalletConnectKeyring = 'WalletConnect',
  // GnosisKeyring = 'Gnosis',
  // CoboArgusKeyring = 'CoboArgus',
}

export type KeyringTypeName =
  // SimpleKeyring
  // | KEYRING_TYPE.HdKeyring
  // BitBox02Keyring
  // TrezorKeyring
  // LedgerBridgeKeyring
  // OnekeyKeyring
  KEYRING_TYPE.WatchAddressKeyring | KEYRING_TYPE.WalletConnectKeyring;
// GnosisKeyring
// LatticeKeyring
// KeystoneKeyring
// CoboArgusKeyring
// CoinbaseKeyring

// export const enum KeyringTypeName {
//   // SimpleKeyring
//   HdKeyring = KEYRING_TYPE.HdKeyring,
//   // BitBox02Keyring
//   // TrezorKeyring
//   // LedgerBridgeKeyring
//   // OnekeyKeyring
//   WatchKeyring = 'Watch Address',
//   WalletConnectKeyring = KEYRING_TYPE.WalletConnectKeyring,
//   // GnosisKeyring
//   // LatticeKeyring
//   // KeystoneKeyring
//   // CoboArgusKeyring
//   // CoinbaseKeyring
// };

// export type KeyringTypeName = typeof KeyringTypeNames[keyof typeof KeyringTypeNames]

export const HARDWARE_KEYRING_TYPES = {
  BitBox02: {
    type: 'BitBox02 Hardware',
    brandName: 'BitBox02',
  },
  Ledger: {
    type: 'Ledger Hardware',
    brandName: 'Ledger',
  },
  Trezor: {
    type: 'Trezor Hardware',
    brandName: 'Trezor',
  },
  Onekey: {
    type: 'Onekey Hardware',
    brandName: 'Onekey',
  },
  GridPlus: {
    type: 'GridPlus Hardware',
    brandName: 'GridPlus',
  },
  Keystone: {
    type: 'QR Hardware Wallet Device',
    brandName: 'Keystone',
  },
} as const;

export type KeyringAccount = {
  address: string;
  brandName: string;
  type?: KeyringTypeName;
  realBrandName?: string;
  realBrandUrl?: string;
};
