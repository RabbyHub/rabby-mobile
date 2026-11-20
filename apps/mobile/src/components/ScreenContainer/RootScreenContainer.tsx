import { ScreenLayouts } from '@/constant/layout';
import { isNil } from 'lodash';
import React from 'react';

import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RootScreenContainer({
  children,
  style,
  fitStatuBar,
  hideBottomBar,
  top: topProp,
}: React.PropsWithChildren<{
  fitStatuBar?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
  hideBottomBar?: boolean;
  top?: number;
}>) {
  const { top } = useSafeAreaInsets();

  return (
    <View
      style={[
        style,
        fitStatuBar && { marginTop: -1 },
        !hideBottomBar && { paddingBottom: ScreenLayouts.bottomBarHeight },
        // eslint-disable-next-line react-native/no-inline-styles
        {
          paddingTop:
            (!isNil(topProp) ? topProp : top) + ScreenLayouts.headerAreaHeight,
          flexDirection: 'column',
          height: '100%',
        },
      ]}>
      {children}
    </View>
  );
}
