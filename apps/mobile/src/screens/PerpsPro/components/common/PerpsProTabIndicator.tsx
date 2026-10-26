import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

export type PerpsProTabIndicatorLayout = Readonly<{
  width: number;
  x: number;
}>;

export type PerpsProTabIndicatorGeometryMode = 'layout' | 'transform';

export type PerpsProTabIndicatorTransform = Readonly<{
  scaleX: number;
  translateX: number;
}>;

export const getPerpsProTabIndicatorFrame = (
  rawPosition: number,
  layouts: readonly PerpsProTabIndicatorLayout[],
): PerpsProTabIndicatorLayout => {
  'worklet';
  if (layouts.length === 0) {
    return { width: 0, x: 0 };
  }

  const maximumIndex = layouts.length - 1;
  const position = Number.isFinite(rawPosition)
    ? Math.max(0, Math.min(maximumIndex, rawPosition))
    : 0;
  const fromIndex = Math.floor(position);
  const toIndex = Math.min(maximumIndex, fromIndex + 1);
  const progress = position - fromIndex;
  const from = layouts[fromIndex] ?? layouts[0]!;
  const to = layouts[toIndex] ?? from;

  return {
    width: from.width + (to.width - from.width) * progress,
    x: from.x + (to.x - from.x) * progress,
  };
};

export const snapPerpsProTabIndicator = (
  position: SharedValue<number>,
  target: number,
) => {
  'worklet';
  cancelAnimation(position);
  position.value = target;
};

export const getPerpsProTabIndicatorTransform = (
  frame: PerpsProTabIndicatorLayout,
  rawBaseWidth: number,
): PerpsProTabIndicatorTransform => {
  'worklet';
  const baseWidth =
    Number.isFinite(rawBaseWidth) && rawBaseWidth > 0 ? rawBaseWidth : 1;
  // React Native scales around the view center. Moving the scaled center to
  // the measured frame center preserves the exact [x, x + width] bounds.
  return {
    scaleX: frame.width / baseWidth,
    translateX: frame.x + (frame.width - baseWidth) / 2,
  };
};

export const PerpsProTabIndicator: React.FC<{
  geometryMode?: PerpsProTabIndicatorGeometryMode;
  layouts: readonly PerpsProTabIndicatorLayout[];
  position: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ geometryMode = 'layout', layouts, position, style, testID }) => {
  const useTransformGeometry = geometryMode === 'transform';
  const firstLayoutWidth = layouts[0]?.width;
  // This width participates in layout only when measured frames change. The
  // high-frequency pager path changes the single transform prop below.
  const baseWidth =
    typeof firstLayoutWidth === 'number' &&
    Number.isFinite(firstLayoutWidth) &&
    firstLayoutWidth > 0
      ? firstLayoutWidth
      : 1;
  const baseGeometryStyle = React.useMemo<ViewStyle | undefined>(
    () =>
      useTransformGeometry
        ? {
            left: 0,
            width: baseWidth,
          }
        : undefined,
    [baseWidth, useTransformGeometry],
  );
  const animatedStyle = useAnimatedStyle(() => {
    const frame = getPerpsProTabIndicatorFrame(position.value, layouts);
    if (useTransformGeometry) {
      if (layouts.length === 0) {
        return {
          opacity: 0,
          transform: [{ translateX: 0 }, { scaleX: 1 }],
        };
      }
      const transform = getPerpsProTabIndicatorTransform(frame, baseWidth);
      return {
        opacity: layouts.length > 0 ? 1 : 0,
        transform: [
          { translateX: transform.translateX },
          { scaleX: transform.scaleX },
        ],
      };
    }
    return {
      left: frame.x,
      opacity: layouts.length > 0 ? 1 : 0,
      width: frame.width,
    };
  }, [baseWidth, layouts, position, useTransformGeometry]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.indicator, baseGeometryStyle, animatedStyle, style]}
      testID={testID}
    />
  );
};

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
  },
});
