import { ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import React, { useMemo } from 'react';

import { KeyboardAvoidingView, View, ViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ContainerAsMap = {
  View: typeof View;
  KeyboardAvoidingView: typeof KeyboardAvoidingView;
  KeyboardAwareScrollView: typeof KeyboardAwareScrollView;
};
type ContainerAs = keyof ContainerAsMap;

export default function NormalScreenContainer<T extends ContainerAs = 'View'>({
  as = 'View' as T,
  children,
  style,
  fitStatuBar,
  overwriteStyle,
}: React.PropsWithChildren<
  {
    as?: T;
    className?: ViewProps['className'];
    fitStatuBar?: boolean;
    style?: React.ComponentProps<typeof View>['style'];
    hideBottomBar?: boolean;
    overwriteStyle?: React.ComponentProps<typeof View>['style'];
  } & React.ComponentProps<ContainerAsMap[T]>
>) {
  const { top } = useSafeAreaInsets();
  const colors = useThemeColors();

  const ViewComp = useMemo(() => {
    switch (as) {
      case 'KeyboardAvoidingView':
        return KeyboardAvoidingView as any as React.FC<
          React.ComponentProps<typeof KeyboardAvoidingView>
        >;
      case 'KeyboardAwareScrollView':
        return KeyboardAwareScrollView as any as React.FC<
          React.ComponentProps<typeof KeyboardAwareScrollView>
        >;
      case 'View':
      default:
        return View as any as React.FC<React.ComponentProps<typeof View>>;
    }
  }, [as]);

  return (
    <ViewComp
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
        overwriteStyle,
      ]}>
      {children}
    </ViewComp>
  );
}
