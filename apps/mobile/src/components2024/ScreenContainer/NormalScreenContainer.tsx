import {
  ReactNativeViewAs,
  ReactNativeViewAsMap,
  getViewComponentByAs,
} from '@/hooks/common/useReactNativeViews';
import { useSafeSizes } from '@/hooks/useAppLayout';
import React, { useMemo } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import {
  LinearGradientContainer,
  LinearGradientContainerProps,
} from './LinearGradientContainer';

export default function NormalScreenContainer2024<
  T extends ReactNativeViewAs = 'View',
>({
  as = 'View' as T,
  noHeader = false,
  children,
  style,
  fitStatuBar,
  overwriteStyle,
  type = 'linear',
}: React.PropsWithChildren<
  {
    as?: T;
    noHeader?: boolean;
    className?: ViewProps['className'];
    fitStatuBar?: boolean;
    style?: React.ComponentProps<typeof View>['style'];
    hideBottomBar?: boolean;
    overwriteStyle?: React.ComponentProps<typeof View>['style'];
    type?: LinearGradientContainerProps['type'];
  } & React.ComponentProps<ReactNativeViewAsMap[T]>
>) {
  const { safeOffHeader, safeTop } = useSafeSizes();
  const ViewComp = useMemo(() => getViewComponentByAs(as), [as]);

  return (
    <LinearGradientContainer type={type}>
      <ViewComp
        style={StyleSheet.flatten([
          style,
          fitStatuBar && { marginTop: -1 },
          {
            paddingTop: noHeader ? safeTop : safeOffHeader,
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
          },
          overwriteStyle,
        ])}>
        {children}
      </ViewComp>
    </LinearGradientContainer>
  );
}
