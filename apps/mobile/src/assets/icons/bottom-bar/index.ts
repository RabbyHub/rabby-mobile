import { default as RcIconNavigationHomeLightCC } from './nav-home-light-cc.svg';
import { default as RcIconNavigationDappsLightCC } from './nav-dapps-light-cc.svg';

import { makeActiveIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

export const RcIconNavigationHomeLight = makeActiveIconFromCC(
  RcIconNavigationHomeLightCC,
  {
    activeColor: ThemeColors.light['blue-default'],
    inactiveAcolor: ThemeColors.light['neutral-foot'],
  },
);

export const RcIconNavigationDappsLight = makeActiveIconFromCC(
  RcIconNavigationDappsLightCC,
  {
    activeColor: ThemeColors.light['blue-default'],
    inactiveAcolor: ThemeColors.light['neutral-foot'],
  },
);
