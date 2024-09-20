import { default as RcIconNavigationHomeLightCC } from './nav-home-light-cc.svg';
import { default as RcIconNavigationHomeFocusLightCC } from './nav-home-focus-light-cc.svg';

import { default as RcIconNavigationDappsLightCC } from './nav-dapps-light-cc.svg';
import { default as RcIconNavigationDappsFocusLightCC } from './nav-dapps-focus-light-cc.svg';

import { default as RcIconPointsLightCC } from '@/assets/icons/bottom-bar/nav-points-light-cc.svg';
import { default as RcIconPointsFocusLightCC } from '@/assets/icons/bottom-bar/nav-points-focus-light-cc.svg';
import { default as RcIconSettingsLightCC } from '@/assets/icons/bottom-bar/nav-settings-light-cc.svg';
import { default as RcIconSettingsFocusLightCC } from '@/assets/icons/bottom-bar/nav-settings-focus-light-cc.svg';

import { default as RcIconHistoryLightCC } from '@/assets/icons/bottom-bar/nav-history-light-cc.svg';
import { default as RcIconHistoryFocusLightCC } from '@/assets/icons/bottom-bar/nav-history-foucs-light-cc.svg';

import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

export const RcIconNavigationHomeLight = makeThemeIconFromCC(
  RcIconNavigationHomeLightCC,
  {
    onLight: ThemeColors.light['neutral-foot'],
    onDark: ThemeColors.dark['neutral-foot'],
  },
);
export const RcIconNavigationHomeFocusLight = makeThemeIconFromCC(
  RcIconNavigationHomeFocusLightCC,
  {
    onLight: ThemeColors.light['blue-default'],
    onDark: ThemeColors.dark['blue-default'],
  },
);

export const RcIconNavigationDappsLight = makeThemeIconFromCC(
  RcIconNavigationDappsLightCC,
  {
    onLight: ThemeColors.light['neutral-foot'],
    onDark: ThemeColors.dark['neutral-foot'],
  },
);

export const RcIconNavigationDappsFocusLight = makeThemeIconFromCC(
  RcIconNavigationDappsFocusLightCC,
  {
    onLight: ThemeColors.light['blue-default'],
    onDark: ThemeColors.dark['blue-default'],
  },
);

export const RcIconPointsLight = makeThemeIconFromCC(RcIconPointsLightCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconPointsFocusLight = makeThemeIconFromCC(
  RcIconPointsFocusLightCC,
  {
    onLight: ThemeColors.light['blue-default'],
    onDark: ThemeColors.dark['blue-default'],
  },
);

export const RcIconSettingLight = makeThemeIconFromCC(RcIconSettingsLightCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconSettingFocusLight = makeThemeIconFromCC(
  RcIconSettingsFocusLightCC,
  {
    onLight: ThemeColors.light['blue-default'],
    onDark: ThemeColors.dark['blue-default'],
  },
);

export const RcIconHistoryLight = makeThemeIconFromCC(RcIconHistoryLightCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconHistoryFocusLight = makeThemeIconFromCC(
  RcIconHistoryFocusLightCC,
  {
    onLight: ThemeColors.light['blue-default'],
    onDark: ThemeColors.dark['blue-default'],
  },
);
