import { ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';

import { View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NormalScreenContainer({
  children,
  style,
  fitStatuBar,
}: React.PropsWithChildren<{
  className?: ViewProps['className'];
  fitStatuBar?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
  hideBottomBar?: boolean;
}>) {
  const { top } = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <View
      style={[
        style,
        fitStatuBar && { marginTop: -1 },
        {
          paddingTop: top + ScreenLayouts.headerAreaHeight,
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: colors['neutral-bg-2'],
        },
      ]}>
      {children}
    </View>
  );
}
