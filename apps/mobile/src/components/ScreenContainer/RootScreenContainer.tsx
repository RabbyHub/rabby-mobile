import { ScreenLayouts } from '@/constant/layout';
import React from 'react';

import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RootScreenContainer({
  children,
  style,
  fitStatuBar,
  hideBottomBar,
}: React.PropsWithChildren<{
  fitStatuBar?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
  hideBottomBar?: boolean;
}>) {
  const { top } = useSafeAreaInsets();

  return (
    <View
      style={[
        style,
        fitStatuBar && { marginTop: -1 },
        !hideBottomBar && { paddingBottom: ScreenLayouts.bottomBarHeight },
        {
          paddingTop: top + ScreenLayouts.headerAreaHeight,
          flexDirection: 'column',
          height: '100%',
        },
      ]}>
      {children}
    </View>
  );
}
