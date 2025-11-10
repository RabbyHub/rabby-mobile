import { useCallback } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import {
  MaterialTabBar,
  MaterialTabBarProps,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';
import { AnimatedStyle } from 'react-native-reanimated';

const disableInnerIndicator = {
  height: 0,
};
interface DynamicCustomMaterialTabBarProps {
  materialTabBarProps: MaterialTabBarProps<string>;
  containerStyle: StyleProp<ViewStyle>;
  indicatorStyle: AnimatedStyle;
  externalContent?: React.ReactNode;
  bgComponent?: React.ReactNode;
}
export const DynamicCustomMaterialTabBar = (
  props: DynamicCustomMaterialTabBarProps,
) => {
  const renderTabItem = useCallback(
    (_props: any) => (
      <MaterialTabItem {..._props} pressOpacity={1} inactiveOpacity={1} />
    ),
    [],
  );
  return (
    <View style={props.containerStyle}>
      <MaterialTabBar
        {...props.materialTabBarProps}
        TabItemComponent={renderTabItem}
        indicatorStyle={disableInnerIndicator}
      />
      {props.externalContent}
      {props.bgComponent}
    </View>
  );
};
