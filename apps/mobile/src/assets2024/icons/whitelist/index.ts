import { ThemeColors2024 } from '@/constant/theme';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { default as RcIconAddWhiteListCC } from './add.svg';

export const RcIconAddWhiteList = makeThemeIconFromCC(RcIconAddWhiteListCC, {
  onLight: ThemeColors2024.light['neutral-body'],
  onDark: ThemeColors2024.dark['neutral-body'],
});
