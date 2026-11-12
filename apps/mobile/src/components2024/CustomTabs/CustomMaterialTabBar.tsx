import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  MaterialTabBar,
  type MaterialTabBarProps,
} from 'react-native-collapsible-tab-view';

/**
 * Horizontally scrollable MaterialTabBar.
 *
 * Each tab keeps its label width, so long translations stay on one line and
 * the bar scrolls instead of wrapping. When every tab fits, the content still
 * spans the full bar width and `space-around` spreads the tabs across it.
 * The built-in indicator follows the measured tab layouts and scrolls with
 * the tabs.
 */
export const CustomMaterialTabBar = ({
  scrollEnabled = true,
  contentContainerStyle,
  indicatorStyle,
  ...props
}: MaterialTabBarProps<string>) => {
  const windowWidth = useWindowDimensions().width;
  const width = props.width ?? windowWidth;

  const mergedContentContainerStyle = React.useMemo(
    () => [styles.contentContainer, { minWidth: width }, contentContainerStyle],
    [contentContainerStyle, width],
  );
  const mergedIndicatorStyle = React.useMemo(
    () => [styles.indicator, indicatorStyle],
    [indicatorStyle],
  );

  return (
    <MaterialTabBar
      {...props}
      scrollEnabled={scrollEnabled}
      contentContainerStyle={mergedContentContainerStyle}
      indicatorStyle={mergedIndicatorStyle}
    />
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    justifyContent: 'space-around',
  },
  indicator: {
    // Tab x offsets are measured from the content container's edge; pin the
    // absolute indicator there so container padding/justify don't shift it.
    left: 0,
  },
});
