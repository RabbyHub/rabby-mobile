import { useIsFocused } from '@react-navigation/native';
import { StatusBarProps } from 'react-native';

import { useThemeColors, useGetBinaryMode } from '@/hooks/theme';
import {
  USE_ANDROID_STATUS_BAR_TRANSPARENT,
  useScreenAppStatusBarConf,
} from './AppStatusBar';
import { AppRootName } from '@/constant/layout';
import { SystemBars } from 'react-native-edge-to-edge';

/**
 * @description this component can be ONLY used in navigation screens
 *
 * @deprecated this component is deprecated, set your screen's status bar config by one of the following ways:
 * - in `makeScreenSpecConfig` in `constant/layout.ts` instead
 * - or just use `ScreenSpecificStatusBar` component directly in your screen
 *
 */
export const FocusAwareStatusBar = (props: StatusBarProps) => {
  const isFocused = useIsFocused();
  const colors = useThemeColors();
  const isLight = useGetBinaryMode() === 'light';

  return isFocused ? <SystemBars {...props} /> : null;
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
