import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { default as RcIconGasAccountCC } from './gas-account-cc.svg';
import { default as RcIconQuoteStartCC } from './quote-start-cc.svg';
import { default as RcIconQuoteEndCC } from './quote-end-cc.svg';

import { ThemeColors } from '@/constant/theme';

export const RcIconGasAccount = makeThemeIconFromCC(RcIconGasAccountCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconQuoteStart = makeThemeIconFromCC(RcIconQuoteStartCC, {
  onLight: ThemeColors.light['blue-light-2'],
  onDark: ThemeColors.dark['blue-light-2'],
});

export const RcIconQuoteEnd = makeThemeIconFromCC(RcIconQuoteEndCC, {
  onLight: ThemeColors.light['blue-light-2'],
  onDark: ThemeColors.dark['blue-light-2'],
});
