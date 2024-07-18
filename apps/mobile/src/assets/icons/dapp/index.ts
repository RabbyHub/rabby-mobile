import {
  makeActiveIconFromCC,
  makeThemeIconFromCC,
} from '@/hooks/makeThemeIcon';

import { default as RcIconDisconnectCC } from './icon-disconnect-cc.svg';
export const RcIconDisconnect = makeActiveIconFromCC(
  RcIconDisconnectCC,
  colors => ({
    activeColor: colors['red-default'],
    inactiveColor: colors['neutral-line'],
  }),
);
