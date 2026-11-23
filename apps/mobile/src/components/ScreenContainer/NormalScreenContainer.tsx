import {
  ReactNativeViewAs,
  ReactNativeViewAsMap,
  getViewComponentByAs,
} from '@/hooks/common/useReactNativeViews';
import { useThemeColors } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';
import React, { useMemo } from 'react';

import { StyleSheet, View } from 'react-native';

export default function NormalScreenContainer<
  T extends ReactNativeViewAs = 'View',
>({
  as = 'View' as T,
  noHeader = false,
  children,
  style,
  fitStatuBar,
  overwriteStyle,
}: React.PropsWithChildren<
  {
    as?: T;
    noHeader?: boolean;
    fitStatuBar?: boolean;
    style?: React.ComponentProps<typeof View>['style'];
    hideBottomBar?: boolean;
    overwriteStyle?: React.ComponentProps<typeof View>['style'];
  } & React.ComponentProps<ReactNativeViewAsMap[T]>
>) {
  const { safeOffHeader, safeTop } = useSafeSizes();
  const columnInset = useSystemColumnInset();
  const colors = useThemeColors();

  const ViewComp = useMemo(() => getViewComponentByAs(as), [as]);

  return (
    <ViewComp
      style={StyleSheet.flatten([
        style,
        fitStatuBar && { marginTop: -1 },
        {
          paddingTop: noHeader ? safeTop : safeOffHeader,
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: colors['neutral-bg-2'],
        },
        columnInset.left > 0 && { paddingLeft: columnInset.left },
        columnInset.right > 0 && { paddingRight: columnInset.right },
        overwriteStyle,
      ])}>
      {children}
    </ViewComp>
  );
}
