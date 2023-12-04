import {ScreenLayouts} from '@/constant/layout';
import React from 'react';

import {View} from 'react-native';

export default function RootScreenContainer({
  children,
}: React.PropsWithChildren<{
  hideBottomBar?: boolean;
}>) {
  return (
    <View
      style={{
        paddingBottom: ScreenLayouts.bottomBarHeight,
        flexDirection: 'column',
        height: '100%',
      }}>
      {children}
    </View>
  );
}
