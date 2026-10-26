import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useApprovalsPage } from '../useApprovalsPage';
import { ApprovalsLayouts } from '../layout';

export function ApprovalsTabView<T extends React.ComponentType<any>>({
  children,
  ViewComponent = View,
  innerStyle,
  ...props
}: React.PropsWithChildren<
  RNViewProps & {
    ViewComponent?: T;
    innerStyle?: RNViewProps['style'];
  } & React.ComponentProps<T>
>) {
  const {
    safeSizeInfo: { safeSizes },
  } = useApprovalsPage();
  const { safeOffBottom } = useSafeSizes();

  return (
    <ViewComponent
      {...props}
      style={[
        props?.style,
        {
          // iOS keeps Tabs' contentInset independently of list padding. On
          // Android our lists override Tabs' paddingTop (20, or 0 for EIP-7702),
          // so the outer tabbar space is still required there.
          paddingTop: Platform.OS === 'ios' ? 0 : ApprovalsLayouts.tabbarHeight,
          paddingBottom:
            safeSizes.bottomAreaHeight +
            (Platform.OS === 'android' ? safeOffBottom : 0),
        },
      ]}>
      <View style={[{ height: '100%', width: '100%' }, innerStyle]}>
        {children}
      </View>
    </ViewComponent>
  );
}
