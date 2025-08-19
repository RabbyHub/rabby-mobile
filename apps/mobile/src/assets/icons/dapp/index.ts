import { makeActiveIconFromCC } from '@/hooks/makeThemeIcon';
export { default as RcIconGlobeCC } from './globe-cc.svg';
export { default as RcIconBallCC } from './ball-cc.svg';
export { default as RcIconJumpCC } from './jump-cc.svg';
export { default as RcIconRightCC } from './right-cc.svg';

import { default as RcIconDisconnectCC } from './icon-disconnect-cc.svg';
export { default as RcIconDynamicArrowCC } from './dynamic-arrow-cc.svg';
export { default as RcIconDynamicArrowDownCC } from './dynamic-arrow-down-cc.svg';
export { default as RcIconGoogle } from './icon-google.svg';
export { default as RcIconCloseBrowser } from './close-browser.svg';
export { default as RcIconCloseBrowserDark } from './close-browser-dark.svg';
export { RcIconDisconnectCC };

export const RcIconDisconnect = makeActiveIconFromCC(
  RcIconDisconnectCC,
  colors => ({
    activeColor: colors['red-default'],
    inactiveColor: colors['neutral-line'],
  }),
);
