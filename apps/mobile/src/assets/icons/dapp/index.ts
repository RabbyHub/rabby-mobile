import {
  makeActiveIconFromCC,
  makeThemeIconFromCC,
} from '@/hooks/makeThemeIcon';

import { default as RcIconDisconnectCC } from './icon-disconnect-cc.svg';
import { themeColors } from '@/constant/theme-colors';
export const RcIconDisconnect = makeActiveIconFromCC(RcIconDisconnectCC, {
  activeColor: themeColors.light['red-default'],
  inactiveAcolor: themeColors.light['neutral-line'],
});
