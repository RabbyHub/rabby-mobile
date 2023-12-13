import { default as RcIconHeaderSettingsCC } from './header-settings-cc.svg';
import { default as RcIconHistoryCC } from './header-history-cc.svg';
import { default as RcIconHeaderAddAccountCC } from './header-add-account-cc.svg';

import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

export const RcIconHeaderSettings = makeThemeIconFromCC(
  RcIconHeaderSettingsCC,
  {
    onLight: 'white',
    onDark: 'white',
  },
);

export const RcIconHistory = makeThemeIconFromCC(RcIconHistoryCC, {
  onLight: 'white',
  onDark: 'white',
});

export const RcIconHeaderAddAccount = makeThemeIconFromCC(
  RcIconHeaderAddAccountCC,
  {
    onLight: ThemeColors.light['neutral-title-1'],
    onDark: ThemeColors.dark['neutral-title-1'],
  },
);
