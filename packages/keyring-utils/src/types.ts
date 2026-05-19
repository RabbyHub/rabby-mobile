export enum KEYRING_TYPE {
  SimpleKeyring = 'Simple Key Pair',
  HdKeyring = 'HD Key Tree',
  // HardwareKeyring = 'hardware',
  WatchAddressKeyring = 'Watch Address',
  WalletConnectKeyring = 'WalletConnect',
  LedgerKeyring = 'Ledger Hardware',
  GnosisKeyring = 'Gnosis',
  // CoboArgusKeyring = 'CoboArgus',
  KeystoneKeyring = 'QR Hardware Wallet Device',
  OneKeyKeyring = 'Onekey Hardware',
  TrezorKeyring = 'Trezor Hardware',
}

export type KeyringTypeName =
  | KEYRING_TYPE.WatchAddressKeyring
  | KEYRING_TYPE.WalletConnectKeyring
  | KEYRING_TYPE.LedgerKeyring
  | KEYRING_TYPE.OneKeyKeyring
  | KEYRING_TYPE.KeystoneKeyring
  | KEYRING_TYPE.GnosisKeyring
  | KEYRING_TYPE.SimpleKeyring
  | KEYRING_TYPE.HdKeyring
  | KEYRING_TYPE.TrezorKeyring;
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
  OneKey: {
    type: 'Onekey Hardware',
    brandName: 'OneKey',
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
  type: KeyringTypeName;
  realBrandName?: string;
  realBrandUrl?: string;
};

export const KEYRING_CLASS = {
  PRIVATE_KEY: KEYRING_TYPE.SimpleKeyring,
  MNEMONIC: KEYRING_TYPE.HdKeyring,
  HARDWARE: {
    // BITBOX02: BitBox02Keyring.type,
    TREZOR: KEYRING_TYPE.TrezorKeyring,
    LEDGER: KEYRING_TYPE.LedgerKeyring,
    KEYSTONE: KEYRING_TYPE.KeystoneKeyring,
    ONEKEY: KEYRING_TYPE.OneKeyKeyring,
    // ONEKEY: OnekeyKeyring.type,
    // GRIDPLUS: LatticeKeyring.type,
  },
  WATCH: KEYRING_TYPE.WatchAddressKeyring,
  WALLETCONNECT: KEYRING_TYPE.WalletConnectKeyring,
  GNOSIS: KEYRING_TYPE.GnosisKeyring,
  // QRCODE: KeystoneKeyring.type,
  // COBO_ARGUS: CoboArgusKeyring.type,
  // COINBASE: CoinbaseKeyring.type,
};

export const CORE_KEYRING_TYPES = [
  KEYRING_CLASS.MNEMONIC,
  KEYRING_CLASS.PRIVATE_KEY,
  ...Object.values(KEYRING_CLASS.HARDWARE),
];

export enum KEYRING_CATEGORY {
  Mnemonic = 'Mnemonic',
  PrivateKey = 'PrivateKey',
  WatchMode = 'WatchMode',
  Contract = 'Contract',
  Hardware = 'Hardware',
  WalletConnect = 'WalletConnect',
}

export const KEYRING_CATEGORY_MAP = {
  [KEYRING_CLASS.MNEMONIC]: KEYRING_CATEGORY.Mnemonic,
  [KEYRING_CLASS.PRIVATE_KEY]: KEYRING_CATEGORY.PrivateKey,
  [KEYRING_CLASS.WATCH]: KEYRING_CATEGORY.WatchMode,
  [KEYRING_CLASS.WALLETCONNECT]: KEYRING_CATEGORY.WalletConnect,
  [KEYRING_CLASS.HARDWARE.LEDGER]: KEYRING_CATEGORY.Hardware,
  [KEYRING_CLASS.HARDWARE.ONEKEY]: KEYRING_CATEGORY.Hardware,
  [KEYRING_CLASS.HARDWARE.TREZOR]: KEYRING_CATEGORY.Hardware,
  // [KEYRING_CLASS.HARDWARE.BITBOX02]: KEYRING_CATEGORY.Hardware,
  [KEYRING_CLASS.HARDWARE.KEYSTONE]: KEYRING_CATEGORY.Hardware,
  [KEYRING_CLASS.GNOSIS]: KEYRING_CATEGORY.Contract,
  // [KEYRING_CLASS.HARDWARE.GRIDPLUS]: KEYRING_CATEGORY.Hardware,
  // [KEYRING_CLASS.Coinbase]: KEYRING_CATEGORY.WalletConnect,
  // [KEYRING_CLASS.GNOSIS]: KEYRING_CATEGORY.Contract,
  // [KEYRING_CLASS.HARDWARE.IMKEY]: KEYRING_CATEGORY.Hardware,
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
  [KEYRING_TYPE.GnosisKeyring]: 'Safe',
  [WALLET_NAME.MetaMask]: 'MetaMask',
  [WALLET_NAME.TP]: 'TokenPocket',
  [WALLET_NAME.imToken]: 'imToken',
  [WALLET_NAME.Zerion]: 'Zerion',
  [WALLET_NAME.Bitget]: 'Bitget Wallet',
  [WALLET_NAME.MathWallet]: 'MathWallet',
  [WALLET_NAME.TRUSTWALLET]: 'Trust Wallet',
  [WALLET_NAME.Rainbow]: 'Rainbow',
  [WALLET_NAME.UnknownWallet]: 'UnknownWallet',
  [KEYRING_CLASS.HARDWARE.LEDGER]: 'Ledger',
  [KEYRING_CLASS.HARDWARE.ONEKEY]: 'OneKey',
  [KEYRING_CLASS.HARDWARE.TREZOR]: 'Trezor',
};
