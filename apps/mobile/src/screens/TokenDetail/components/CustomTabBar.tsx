import { Indicator } from '@/components2024/CustomTabs/CustomIndicator';
import { useCallback, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import {
  MaterialTabBar,
  MaterialTabBarProps,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';
import { ItemLayout } from 'react-native-collapsible-tab-view/lib/typescript/src/MaterialTabBar/types';
import { AnimatedStyle } from 'react-native-reanimated';

const disableInnerIndicator = {
  height: 0,
};
interface DynamicCustomMaterialTabBarProps {
  materialTabBarProps: MaterialTabBarProps<string>;
  containerStyle: StyleProp<ViewStyle>;
  indicatorStyle: AnimatedStyle;
  initialTabItemsLayout: ItemLayout[];
  initPaddingLeft: number;
  externalContent?: React.ReactNode;
}
export const DynamicCustomMaterialTabBar = (
  props: DynamicCustomMaterialTabBarProps,
) => {
  const [tabItemsLayout, setTabItemsLayout] = useState<
    {
      x: number;
      width: number;
    }[]
  >(props.initialTabItemsLayout);

  const handleTabItemLayout = useCallback(
    (index: number, e: any) => {
      const tabsPaddingLeft = props.initPaddingLeft ?? 0;
      const { x, width } = e.nativeEvent.layout;
      const nextX = x + tabsPaddingLeft;
      setTabItemsLayout(prev => {
        const next = [...prev];
        if (
          !next[index] ||
          next[index].x !== nextX ||
          next[index].width !== width
        ) {
          next[index] = { x: nextX, width };
          return next;
        }
        return prev;
      });
    },
    [props.initPaddingLeft],
  );
  const renderTabItem = useCallback(
    (_props: any) => (
      <MaterialTabItem
        {..._props}
        onLayout={event => handleTabItemLayout(_props.index, event)}
        pressOpacity={1}
        inactiveOpacity={1}
      />
    ),
    [handleTabItemLayout],
  );
  return (
    <View style={props.containerStyle}>
      <MaterialTabBar
        {...props.materialTabBarProps}
        TabItemComponent={renderTabItem}
        indicatorStyle={disableInnerIndicator}
      />
      <Indicator
        indexDecimal={props.materialTabBarProps.indexDecimal}
        style={props.indicatorStyle}
        itemsLayout={tabItemsLayout}
        fadeIn
      />
      {props.externalContent}
    </View>
  );
};
