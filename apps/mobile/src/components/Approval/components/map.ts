import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const WaitingSignComponent = {
  [KEYRING_CLASS.WALLETCONNECT]: 'WatchAddressWaiting',
  [KEYRING_CLASS.MNEMONIC]: 'PrivatekeyWaiting',
  [KEYRING_CLASS.PRIVATE_KEY]: 'PrivatekeyWaiting',
  [KEYRING_CLASS.HARDWARE.LEDGER]: 'LedgerHardwareWaiting',
  [KEYRING_CLASS.HARDWARE.ONEKEY]: 'OneKeyHardwareWaiting',
  [KEYRING_CLASS.HARDWARE.KEYSTONE]: 'KeystoneHardwareWaiting',
};

export const WaitingSignMessageComponent = {
  [KEYRING_CLASS.WALLETCONNECT]: 'WatchAddressWaiting',
  [KEYRING_CLASS.HARDWARE.LEDGER]: 'LedgerHardwareWaiting',
  [KEYRING_CLASS.HARDWARE.KEYSTONE]: 'KeystoneHardwareWaiting',
  [KEYRING_CLASS.HARDWARE.ONEKEY]: 'OneKeyHardwareWaiting',
};
