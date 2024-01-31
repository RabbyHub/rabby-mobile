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
import WalletCC from '@/assets/icons/address/wallet-cc.svg';
import HardwareCC from '@/assets/icons/address/hardware-cc.svg';

export const WalletSVG = makeThemeIconFromCC(WalletCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const HardwareSVG = makeThemeIconFromCC(HardwareCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});
export { default as RcIconMobileWallet } from './mobile-wallet.svg';

import WhitelistCC from '@/assets/icons/address/whitelist-cc.svg';
export const RcWhiteList = makeThemeIconFromCC(WhitelistCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});
