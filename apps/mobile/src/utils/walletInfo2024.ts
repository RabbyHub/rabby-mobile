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
import WatchDarkDark from '@/assets2024/icons/wallet/watch_dark.png';
import SafePNG from '@/assets2024/icons/wallet/safe.png';
import TrezorPNG from '@/assets2024/icons/wallet/trezor.png';
import blockies from 'ethereum-blockies-base64';
import { preferenceService } from '@/core/services';

export const getWalletAvator2024 = (
  brandName: string | undefined,
  isLight?: boolean,
  address?: string,
) => {
  const watchAvator = isLight ? WatchPNG : WatchDarkDark;
  if (brandName === KEYRING_CLASS.GNOSIS) {
    return SafePNG;
  }
  if (brandName === KEYRING_CLASS.WATCH) {
    return watchAvator;
  }
  if (address) {
    const cacheAvatar = preferenceService.getAddressAvatar(address);
    if (cacheAvatar) {
      return { uri: cacheAvatar };
    }
    const avatar = blockies(address);
    preferenceService.addAddressAvatar(address, avatar);
    return { uri: avatar };
  }
  return undefined;
};

export const getWalletIcon2024 = (
  brandName: string | undefined,
  isLight?: boolean,
) => {
  if (brandName === KEYRING_CLASS.HARDWARE.LEDGER) {
    return LedgerPNG;
  }

  if (brandName === KEYRING_CLASS.HARDWARE.ONEKEY) {
    return OneKeyPNG;
  }

  if (brandName === KEYRING_CLASS.HARDWARE.TREZOR) {
    return TrezorPNG;
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
  return isLight ? WatchPNG : WatchDarkDark;
};
export const showSubWalletIcon = (brandName: string | undefined) => {
  return (
    brandName === KEYRING_CLASS.HARDWARE.LEDGER ||
    brandName === KEYRING_CLASS.HARDWARE.ONEKEY ||
    brandName === HARDWARE_KEYRING_TYPES.Keystone.brandName ||
    brandName === KEYRING_CLASS.HARDWARE.KEYSTONE ||
    brandName === KEYRING_CLASS.HARDWARE.TREZOR
  );
};
