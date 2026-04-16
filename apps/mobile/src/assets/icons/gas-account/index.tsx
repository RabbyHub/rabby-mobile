import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { default as RcIconGasAccountCC } from './gas-account-cc.svg';
import { default as RcIconQuoteStartCC } from './quote-start-cc.svg';
import { default as RcIconQuoteEndCC } from './quote-end-cc.svg';
import { default as RcIconHeaderRightCC } from './header-right-cc.svg';

import { ThemeColors } from '@/constant/theme';

export const RcIconGasAccount = makeThemeIconFromCC(RcIconGasAccountCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconQuoteStart = makeThemeIconFromCC(RcIconQuoteStartCC, {
  onLight: ThemeColors.light['blue-light-disable'],
  onDark: ThemeColors.dark['blue-light-disable'],
});

export const RcIconQuoteEnd = makeThemeIconFromCC(RcIconQuoteEndCC, {
  onLight: ThemeColors.light['blue-light-disable'],
  onDark: ThemeColors.dark['blue-light-disable'],
});

export const RcIconGasAccountHeaderRight = makeThemeIconFromCC(
  RcIconHeaderRightCC,
  {
    onLight: ThemeColors.light['neutral-title-1'],
    onDark: ThemeColors.dark['neutral-title-1'],
  },
);
