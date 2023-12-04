import { default as RcIconNavigationHomeLightCC } from './nav-home-light-cc.svg';
import { default as RcIconNavigationDappsLightCC } from './nav-dapps-light-cc.svg';

import { makeActiveIconByCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

export const RcIconNavigationHomeLight = makeActiveIconByCC(
  RcIconNavigationHomeLightCC,
  {
    activeColor: ThemeColors.light['blue-default'],
    inactiveAcolor: ThemeColors.light['neutral-foot'],
  },
);

export const RcIconNavigationDappsLight = makeActiveIconByCC(
  RcIconNavigationDappsLightCC,
  {
    activeColor: ThemeColors.light['blue-default'],
    inactiveAcolor: ThemeColors.light['neutral-foot'],
  },
);
