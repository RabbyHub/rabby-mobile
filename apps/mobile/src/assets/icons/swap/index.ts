import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

import { default as RcIconHeaderSwapHistoryCC } from './history-cc.svg';
import { default as RcIconHeaderSettingsCC } from './settings-cc.svg';
import { default as RcIconRightArrowCC } from './right-arrow-cc.svg';
import { default as RcIconEmptyCC } from './empty-cc.svg';
import { default as RcIconSwapArrowCC } from './swap-arrow-cc.svg';
import { default as RcIconSwapBottomArrowCC } from './bottom-arrow-cc.svg';
import { default as RcIconSwapUncheckedCC } from './unchecked-cc.svg';
import { default as RcIconSwapCheckedCC } from './check-cc.svg';
import { default as RcIconSwapGasCC } from './gas-cc.svg';
import { default as RcIconSwitchQuoteCC } from './switch-cc.svg';
import { default as RcIconArrowUpCC } from './arrow-up-cc.svg';
import { default as RcIconSwapInfoCC } from './warning-cc.svg';
import { default as RcIconSwapHiddenArrowCC } from './hidden-arrow-cc.svg';
import { default as RcIconSwapReceiveInfoCC } from './info-outline-cc.svg';
import { default as RcIconMaxButton } from './max-button.svg';
import { default as RcIconWalletCC } from './wallet-cc.svg';

export { RcIconSwitchQuoteCC, RcIconMaxButton };

export const RcIconSwapHistory = makeThemeIconFromCC(
  RcIconHeaderSwapHistoryCC,
  {
    onLight: ThemeColors.light['neutral-body'],
    onDark: ThemeColors.dark['neutral-body'],
  },
);

export const RcIconSwapSettings = makeThemeIconFromCC(RcIconHeaderSettingsCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconSwapRightArrow = makeThemeIconFromCC(RcIconRightArrowCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconSwapHistoryEmpty = makeThemeIconFromCC(RcIconEmptyCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconSwapArrow = makeThemeIconFromCC(RcIconSwapArrowCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconSwapBottomArrow = makeThemeIconFromCC(
  RcIconSwapBottomArrowCC,
  {
    onLight: ThemeColors.light['neutral-foot'],
    onDark: ThemeColors.dark['neutral-foot'],
  },
);

export const RcIconSwapUnchecked = makeThemeIconFromCC(RcIconSwapUncheckedCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconSwapChecked = makeThemeIconFromCC(RcIconSwapCheckedCC, {
  onLight: ThemeColors.light['blue-default'],
  onDark: ThemeColors.light['blue-default'],
});

export const RcIconSwapGas = makeThemeIconFromCC(RcIconSwapGasCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconSwapGasRed = makeThemeIconFromCC(RcIconSwapGasCC, {
  onLight: ThemeColors.light['red-default'],
  onDark: ThemeColors.dark['red-default'],
});

export const RcIconSwitchQuote = makeThemeIconFromCC(RcIconSwitchQuoteCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconArrowUp = makeThemeIconFromCC(RcIconArrowUpCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconSwapInfo = makeThemeIconFromCC(RcIconSwapInfoCC, {
  onLight: ThemeColors.light['neutral-title-2'],
  onDark: ThemeColors.light['neutral-title-2'],
});

export const RcIconSwapHiddenArrow = makeThemeIconFromCC(
  RcIconSwapHiddenArrowCC,
  {
    onLight: ThemeColors.light['neutral-foot'],
    onDark: ThemeColors.dark['neutral-foot'],
  },
);

export const RcIconSwapReceiveInfo = makeThemeIconFromCC(
  RcIconSwapReceiveInfoCC,
  {
    onLight: ThemeColors.light['neutral-foot'],
    onDark: ThemeColors.dark['neutral-foot'],
  },
);

export const RcIconWallet = makeThemeIconFromCC(RcIconWalletCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});
