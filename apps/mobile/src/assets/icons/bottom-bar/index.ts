import { default as RcIconNavigationHomeLightCC } from './nav-home-light-cc.svg';
import { default as RcIconNavigationHomeFocusLightCC } from './nav-home-focus-light-cc.svg';

import { default as RcIconNavigationDappsLightCC } from './nav-dapps-light-cc.svg';
import { default as RcIconNavigationDappsFocusLightCC } from './nav-dapps-focus-light-cc.svg';

import { makeActiveIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

export const RcIconNavigationHomeLight = makeActiveIconFromCC(
  RcIconNavigationHomeLightCC,
  {
    activeColor: ThemeColors.light['blue-default'],
    inactiveAcolor: ThemeColors.light['neutral-foot'],
  },
);
export const RcIconNavigationHomeFocusLight = makeActiveIconFromCC(
  RcIconNavigationHomeFocusLightCC,
  {
    activeColor: ThemeColors.light['blue-default'],
    inactiveAcolor: ThemeColors.light['blue-default'],
  },
);

export const RcIconNavigationDappsLight = makeActiveIconFromCC(
  RcIconNavigationDappsLightCC,
  {
    activeColor: ThemeColors.light['neutral-foot'],
    inactiveAcolor: ThemeColors.light['neutral-foot'],
  },
);

export const RcIconNavigationDappsFocusLight = makeActiveIconFromCC(
  RcIconNavigationDappsFocusLightCC,
  {
    activeColor: ThemeColors.light['blue-default'],
    inactiveAcolor: ThemeColors.light['blue-default'],
  },
);
