import {default as RcIconHeaderSettingsCC} from './header-settings-cc.svg';
import {default as RcIconHistoryCC} from './header-history-cc.svg';

import {makeThemeIconByCC} from '@/hooks/makeThemeIcon';

export const RcIconHeaderSettings = makeThemeIconByCC(RcIconHeaderSettingsCC, {
  onLight: 'white',
  onDark: 'white',
});

export const RcIconHistory = makeThemeIconByCC(RcIconHistoryCC, {
  onLight: 'white',
  onDark: 'white',
});
