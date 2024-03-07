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
