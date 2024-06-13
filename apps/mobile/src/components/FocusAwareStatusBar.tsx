import { useIsFocused } from '@react-navigation/native';
import { StatusBar, StatusBarProps } from 'react-native';

import { useThemeColors, useGetAppThemeMode } from '@/hooks/theme';
import {
  USE_ANDROID_STATUS_BAR_TRANSPARENT,
  useScreenAppStatusBarConf,
} from './AppStatusBar';
import { AppRootName } from '@/constant/layout';

/**
 * @description this component can be ONLY used in navigation screens
 *
 * @deprecated this component is deprecated, set your screen's status bar config by one of the following ways:
 * - in `getRootSpecConfig` in `constant/layout.ts` instead
 * - or just use `ScreenSpecificStatusBar` component directly in your screen
 *
 */
export const FocusAwareStatusBar = (props: StatusBarProps) => {
  const isFocused = useIsFocused();
  const colors = useThemeColors();
  const isLight = useGetAppThemeMode() === 'light';

  return isFocused ? (
    <StatusBar
      backgroundColor={colors['neutral-bg-1']}
      barStyle={isLight ? 'dark-content' : 'light-content'}
      translucent={USE_ANDROID_STATUS_BAR_TRANSPARENT}
      {...props}
    />
  ) : null;
};

export const ScreenSpecificStatusBar = ({
  screenName,
  ...props
}: { screenName?: AppRootName } & StatusBarProps) => {
  const { routeStatusbarConf } = useScreenAppStatusBarConf(screenName);

  return (
    <FocusAwareStatusBar
      animated
      translucent={USE_ANDROID_STATUS_BAR_TRANSPARENT}
      backgroundColor={routeStatusbarConf.androidStatusBarBg}
      barStyle={routeStatusbarConf.barStyle}
      {...props}
    />
  );
};
