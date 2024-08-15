import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const SUPPORT_1559_KEYRING_TYPE = [
  KEYRING_CLASS.HARDWARE.LEDGER,
  // KEYRING_CLASS.HARDWARE.GRIDPLUS,
  KEYRING_CLASS.PRIVATE_KEY,
  KEYRING_CLASS.MNEMONIC,
  KEYRING_CLASS.HARDWARE.KEYSTONE,
  // KEYRING_CLASS.HARDWARE.TREZOR,
  KEYRING_CLASS.HARDWARE.ONEKEY,
];

export const hex2Text = (hex: string) => {
  try {
    return hex.startsWith('0x')
      ? decodeURIComponent(
          hex.replace(/^0x/, '').replace(/[0-9a-f]{2}/g, '%$&'),
        )
      : hex;
  } catch {
    return hex;
  }
};
