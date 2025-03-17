import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_CLASS,
} from '@rabby-wallet/keyring-utils';
import LedgerPNG from '@/assets2024/icons/wallet/ledger.png';
import KeystonePNG from '@/assets2024/icons/wallet/keystone.png';
import OneKeyPNG from '@/assets2024/icons/wallet/onekey.png';
import PrivateKeyPNG from '@/assets2024/icons/wallet/private-key.png';
import SeedPNG from '@/assets2024/icons/wallet/seed.png';
import WatchPNG from '@/assets2024/icons/wallet/watch@2x.png';
import WatchDarkDark from '@/assets2024/icons/wallet/watch_dark@2x.png';
import SafePNG from '@/assets2024/icons/wallet/safe.png';
import { WALLET_INFO } from './walletInfo';

export const getWalletIcon2024 = (
  brandName: string | undefined,
  isLight?: boolean,
) => {
  if (brandName === KEYRING_CLASS.WATCH) {
    return isLight ? WatchPNG : WatchDarkDark;
  }
  if (brandName === KEYRING_CLASS.HARDWARE.LEDGER) {
    return LedgerPNG;
  }

  if (brandName === KEYRING_CLASS.HARDWARE.ONEKEY) {
    return OneKeyPNG;
  }

  if (
    brandName === HARDWARE_KEYRING_TYPES.Keystone.brandName ||
    brandName === KEYRING_CLASS.HARDWARE.KEYSTONE
  ) {
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

  if (brandName === KEYRING_CLASS.PRIVATE_KEY) {
    return PrivateKeyPNG;
  }

  return (
    WALLET_INFO?.[brandName as keyof typeof WALLET_INFO]?.icon ||
    WALLET_INFO.UnknownWallet.icon
  );
};
