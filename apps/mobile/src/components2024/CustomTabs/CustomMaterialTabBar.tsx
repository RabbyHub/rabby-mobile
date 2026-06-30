import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import {
  MaterialTabBar,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';
import { Indicator } from './CustomIndicator';

const disableInnerIndicator = {
  height: 0,
};
const INDICATOR_WIDTH_RATIO = 0.75;

function makeFallbackItemsLayout(tabCount: number, width: number) {
  const safeTabCount = Math.max(tabCount, 1);
  const tabWidth = width / safeTabCount;
  const indicatorWidth = tabWidth * INDICATOR_WIDTH_RATIO;

  return Array.from({ length: safeTabCount }, (_, index) => ({
    width: indicatorWidth,
    x: index * tabWidth + (tabWidth - indicatorWidth) / 2,
  }));
}

export const CustomMaterialTabBar = (props: any) => {
  const { width } = useWindowDimensions();
  const [tabItemsLayout, setTabItemsLayout] = React.useState<
    {
      width: number;
      x: number;
    }[]
  >([]);

  const { TabItemComponent = MaterialTabItem, tabNames = [] } = props;
  const fallbackItemsLayout = React.useMemo(
    () => makeFallbackItemsLayout(tabNames.length, width),
    [tabNames.length, width],
  );

  const itemsLayout = React.useMemo(() => {
    return fallbackItemsLayout.map((layout, index) => {
      return tabItemsLayout[index] || layout;
    });
  }, [fallbackItemsLayout, tabItemsLayout]);

  const handleTabItemLayout = React.useCallback((index: number, e: any) => {
    const { x, width: itemWidth } = e.nativeEvent.layout;
    const indicatorWidth = itemWidth * INDICATOR_WIDTH_RATIO;
    const nextLayout = {
      width: indicatorWidth,
      x: x + (itemWidth - indicatorWidth) / 2,
    };

    setTabItemsLayout(prev => {
      if (
        prev[index]?.x === nextLayout.x &&
        prev[index]?.width === nextLayout.width
      ) {
        return prev;
      }

      const next = [...prev];
      next[index] = nextLayout;
      return next;
    });
  }, []);

  const renderTabItem = React.useCallback(
    (tabItemProps: any) => {
      const originalOnLayout = tabItemProps.onLayout;

      return (
        <TabItemComponent
          {...tabItemProps}
          onLayout={(event: any) => {
            originalOnLayout?.(event);
            handleTabItemLayout(tabItemProps.index, event);
          }}
        />
      );
    },
    [TabItemComponent, handleTabItemLayout],
  );

  return (
    <View>
      <MaterialTabBar
        {...props}
        TabItemComponent={renderTabItem}
        indicatorStyle={disableInnerIndicator}
      />
      <Indicator
        indexDecimal={props.indexDecimal}
        style={props.indicatorStyle}
        itemsLayout={itemsLayout}
        fadeIn
      />
    </View>
  );
};
