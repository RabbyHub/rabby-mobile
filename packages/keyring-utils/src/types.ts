export enum KEYRING_TYPE {
  SimpleKeyring = 'Simple Key Pair',
  HdKeyring = 'HD Key Tree',
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

export const KEYRING_CLASS = {
  PRIVATE_KEY: KEYRING_TYPE.SimpleKeyring,
  MNEMONIC: KEYRING_TYPE.HdKeyring,
  // HARDWARE: {
  //   BITBOX02: BitBox02Keyring.type,
  //   TREZOR: TrezorKeyring.type,
  //   LEDGER: LedgerBridgeKeyring.type,
  //   ONEKEY: OnekeyKeyring.type,
  //   GRIDPLUS: LatticeKeyring.type,
  // },
  WATCH: KEYRING_TYPE.WatchAddressKeyring,
  WALLETCONNECT: KEYRING_TYPE.WalletConnectKeyring,
  // GNOSIS: GnosisKeyring.type,
  // QRCODE: KeystoneKeyring.type,
  // COBO_ARGUS: CoboArgusKeyring.type,
  // COINBASE: CoinbaseKeyring.type,
};

export enum WALLET_NAME {
  Bitget = 'Bitget',
  MetaMask = 'MetaMask',
  TP = 'TP',
  Rainbow = 'Rainbow',
  imToken = 'imToken',
  Zerion = 'Zerion',
  MathWallet = 'MATHWALLET',
  'TRUSTWALLET' = 'TRUSTWALLET',
  UnknownWallet = 'UnknownWallet',
}

export const BRAND_ALIAS_TYPE_TEXT = {
  [KEYRING_TYPE.HdKeyring]: 'Seed Phrase',
  [KEYRING_TYPE.SimpleKeyring]: 'Private Key',
  [KEYRING_TYPE.WatchAddressKeyring]: 'Contact',
  [WALLET_NAME.MetaMask]: 'MetaMask Mobile',
  [WALLET_NAME.TP]: 'TokenPocket',
  [WALLET_NAME.imToken]: 'imToken',
  [WALLET_NAME.Zerion]: 'Zerion',
  [WALLET_NAME.Bitget]: 'Bitget',
  [WALLET_NAME.MathWallet]: 'MathWallet',
  [WALLET_NAME.TRUSTWALLET]: 'Trust Wallet',
  [WALLET_NAME.Rainbow]: 'TruRainbow',
};
