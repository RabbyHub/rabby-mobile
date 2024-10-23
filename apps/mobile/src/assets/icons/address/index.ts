import { ThemeColors } from '@/constant/theme';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';

export { default as RcIconWatchAddress } from './watch.svg';
export { default as RcIconAddressRight } from './right-arrow.svg';
export { default as RcIconAddressBoldRight } from './bold-right-arrow.svg';
export { default as RcIconAddressPinned } from './pinned.svg';
export { default as RcIconAddressPin } from './pin.svg';
export { default as RcIconAddressDelete } from './delete.svg';
export { default as RcIconAddressDetailEdit } from './edit.svg';

export { default as RcIconAddressWhitelistCC } from './whitelist.svg';
export { default as RcIconScannerCC } from './scanner-cc.svg';
export { default as RcIconScannerDownArrowCC } from './scan-down-arrow-cc.svg';
export { default as RcIconSAddressRisk } from './address-risk.svg';
export { default as RcIconTagYou } from './icon-tag-you.svg';
export { default as RcIconTagNotYou } from './icon-tag-not-you.svg';
import WalletCC from '@/assets/icons/address/wallet-cc.svg';
import HardwareCC from '@/assets/icons/address/hardware-cc.svg';
import ImportAddressCC from '@/assets/icons/address/import-address-cc.svg';
import CreateAddressCC from '@/assets/icons/address/create-address-cc.svg';
import PrivateKeyCC from '@/assets/icons/wallet/private-key.svg';
import SeedPhraseCC from '@/assets/icons/wallet/seed.svg';
export { default as RcIconAddCircle } from '@/assets/icons/address/add-circle-cc.svg';
export { default as RcIconCreateSeed } from '@/assets/icons/address/create-seed-cc.svg';
export { default as RcIcoAddSeed } from '@/assets/icons/address/add-seed-cc.svg';
export { default as RcIconInnerScanner } from './inner-scan.svg';

export const WalletSVG = makeThemeIconFromCC(WalletCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const HardwareSVG = makeThemeIconFromCC(HardwareCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});
export { default as RcIconMobileWallet } from './mobile-wallet.svg';

import WhitelistEnabledCC from '@/assets/icons/address/whitelist-enabled-cc.svg';
export const RcWhiteListEnabled = makeThemeIconFromCC(WhitelistEnabledCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

import WhitelistDisabledCC from '@/assets/icons/address/whitelist-disabled-cc.svg';
export const RcWhiteListDisabled = makeThemeIconFromCC(WhitelistDisabledCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const ImportAddressSVG = makeThemeIconFromCC(ImportAddressCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const CreateAddressSVG = makeThemeIconFromCC(CreateAddressCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const PrivateKeySVG = makeThemeIconFromCC(PrivateKeyCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const PrivateKeySVGLight = makeThemeIconFromCC(PrivateKeyCC, {
  onLight: '#ffffff',
  onDark: '#ffffff',
});

export const SeedPhraseSVG = makeThemeIconFromCC(SeedPhraseCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const SeedPhraseSVGLight = makeThemeIconFromCC(SeedPhraseCC, {
  onLight: '#ffffff',
  onDark: '#ffffff',
});
