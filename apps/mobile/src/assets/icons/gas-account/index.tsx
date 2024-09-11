import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { default as RcIconGasAccountCC } from './gas-account-cc.svg';
import { ThemeColors } from '@/constant/theme';

export const RcIconGasAccount = makeThemeIconFromCC(RcIconGasAccountCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});
