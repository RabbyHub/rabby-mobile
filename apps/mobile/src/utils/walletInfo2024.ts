import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_CLASS,
} from '@rabby-wallet/keyring-utils';
import LedgerPNG from '@/assets2024/icons/wallet/ledger.png';
import KeystonePNG from '@/assets2024/icons/wallet/keystone.png';
import OneKeyPNG from '@/assets2024/icons/wallet/onekey.png';
import PrivateKeyPNG from '@/assets2024/icons/wallet/private-key.png';
import SeedPNG from '@/assets2024/icons/wallet/seed.png';
import WatchPNG from '@/assets2024/icons/wallet/watch.png';
import SafePNG from '@/assets2024/icons/wallet/safe.png';

export const getWalletIcon2024 = (
  brandName: string | undefined,
  isLight?: boolean,
) => {
  if (brandName === KEYRING_CLASS.WATCH) {
    return WatchPNG;
  }
  if (brandName === KEYRING_CLASS.HARDWARE.LEDGER) {
    return LedgerPNG;
  }

  if (brandName === KEYRING_CLASS.HARDWARE.ONEKEY) {
    return OneKeyPNG;
  }

  if (brandName === HARDWARE_KEYRING_TYPES.Keystone.brandName) {
    return KeystonePNG;
  }

  if (brandName === KEYRING_CLASS.GNOSIS) {
    return SafePNG;
  }

  if (brandName === KEYRING_CLASS.PRIVATE_KEY) {
    return PrivateKeyPNG;
  }

  if (brandName === KEYRING_CLASS.MNEMONIC) {
    return SeedPNG;
  }

  return PrivateKeyPNG;
};
