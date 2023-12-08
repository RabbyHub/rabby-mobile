import WatchKeyring from '@rabby-wallet/eth-keyring-watch';
import { KEYRING_TYPE, KeyringIntf } from '@rabby-wallet/keyring-utils';

export const keyringSdks = {
  WatchKeyring,
} as const;

/** @deprecated just for compatibility on COPY codes from extension, use keyringSdks as possible */
export const KEYRING_SDK_TYPES = keyringSdks;

export const KEYRING_CLASS = {
  // PRIVATE_KEY: SimpleKeyring.type,
  // MNEMONIC: HdKeyring.type,
  // HARDWARE: {
  //   BITBOX02: BitBox02Keyring.type,
  //   TREZOR: TrezorKeyring.type,
  //   LEDGER: LedgerBridgeKeyring.type,
  //   ONEKEY: OnekeyKeyring.type,
  //   GRIDPLUS: LatticeKeyring.type,
  // },
  WATCH: WatchKeyring.type,

  // TODO: implement in the future, replace it with #Class.type
  WALLETCONNECT: KEYRING_TYPE.WalletConnectKeyring,
  // GNOSIS: GnosisKeyring.type,
  // QRCODE: KeystoneKeyring.type,
  // COBO_ARGUS: CoboArgusKeyring.type,
  // COINBASE: CoinbaseKeyring.type,
};

export type KeyringClassType = typeof keyringSdks[keyof typeof keyringSdks];

export type KeyringInstance = InstanceType<KeyringClassType> | KeyringIntf;
