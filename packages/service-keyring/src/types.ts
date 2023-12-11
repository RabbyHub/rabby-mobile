import WatchKeyring from '@rabby-wallet/eth-keyring-watch';
import type { KeyringIntf } from '@rabby-wallet/keyring-utils';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

export const keyringSdks = {
  WatchKeyring,
} as const;

/** @deprecated just for compatibility on COPY codes from extension, use keyringSdks as possible */
export const KEYRING_SDK_TYPES = keyringSdks;

// TODO: 补全
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
  WATCH: KEYRING_TYPE.WatchAddressKeyring,
  WALLETCONNECT: KEYRING_TYPE.WalletConnectKeyring,
  // GNOSIS: GnosisKeyring.type,
  // QRCODE: KeystoneKeyring.type,
  // COBO_ARGUS: CoboArgusKeyring.type,
  // COINBASE: CoinbaseKeyring.type,
};

export type KeyringClassType = (typeof keyringSdks)[keyof typeof keyringSdks];

export type KeyringInstance = InstanceType<KeyringClassType> | KeyringIntf;
