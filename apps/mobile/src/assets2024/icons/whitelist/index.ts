import { ThemeColors2024 } from '@/constant/theme';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { default as RcIconAddWhiteListCC } from './add.svg';
import { default as RcIconLockCC } from './lock-light.svg';
import { ManIcon } from './Man';

export const RcIconAddWhiteList = makeThemeIconFromCC(RcIconAddWhiteListCC, {
  onLight: ThemeColors2024.light['neutral-body'],
  onDark: ThemeColors2024.dark['neutral-body'],
});

export const RcIconMan = ManIcon;

export const RcIconLock = makeThemeIconFromCC(RcIconLockCC, {
  onLight: ThemeColors2024.light['brand-disable'],
  onDark: ThemeColors2024.dark['brand-disable'],
});
