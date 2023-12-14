import { default as RcIconHeaderSettingsCC } from './header-settings-cc.svg';
import { default as RcIconHistoryCC } from './header-history-cc.svg';
import { default as RcIconHeaderAddAccountCC } from './header-add-account-cc.svg';

import { makeThemeIconByCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

export const RcIconHeaderSettings = makeThemeIconByCC(RcIconHeaderSettingsCC, {
  onLight: 'white',
  onDark: 'white',
});

export const RcIconHistory = makeThemeIconByCC(RcIconHistoryCC, {
  onLight: 'white',
  onDark: 'white',
});

export const RcIconHeaderAddAccount = makeThemeIconByCC(
  RcIconHeaderAddAccountCC,
  {
    onLight: ThemeColors.light['neutral-title-1'],
    onDark: ThemeColors.dark['neutral-title-1'],
  },
);

export const RcIconButtonAddAccount = makeThemeIconByCC(
  RcIconHeaderAddAccountCC,
  {
    onLight: ThemeColors.light['blue-default'],
    onDark: ThemeColors.light['blue-default'],
  },
);
