import {ScreenLayouts} from '@/constant/layout';
import React from 'react';

import {View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export default function NormalScreenContainer({
  children,
  style,
  fitStatuBar,
}: React.PropsWithChildren<{
  fitStatuBar?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
  hideBottomBar?: boolean;
}>) {
  const {top} = useSafeAreaInsets();

  return (
    <View
      style={[
        style,
        fitStatuBar && {marginTop: -1},
        {
          paddingTop: top + ScreenLayouts.headerAreaHeight,
          flexDirection: 'column',
          width: '100%',
          height: '100%',
        },
      ]}>
      {children}
    </View>
  );
}
