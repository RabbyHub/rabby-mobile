import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export type PerpsProTabIndicatorLayout = Readonly<{
  width: number;
  x: number;
}>;

export const PERPS_PRO_TAB_INDICATOR_DURATION_MS = 300;

const PERPS_PRO_TAB_INDICATOR_TIMING_CONFIG = {
  duration: PERPS_PRO_TAB_INDICATOR_DURATION_MS,
  easing: Easing.bezier(0, 0, 0.2, 1),
  reduceMotion: ReduceMotion.System,
} as const;

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

export const animatePerpsProTabIndicator = (
  position: SharedValue<number>,
  target: number,
) => {
  position.value = withTiming(target, PERPS_PRO_TAB_INDICATOR_TIMING_CONFIG);
};

export const snapPerpsProTabIndicator = (
  position: SharedValue<number>,
  target: number,
) => {
  cancelAnimation(position);
  position.value = target;
};

export const PerpsProTabIndicator: React.FC<{
  layouts: readonly PerpsProTabIndicatorLayout[];
  position: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ layouts, position, style, testID }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const frame = getPerpsProTabIndicatorFrame(position.value, layouts);
    return {
      opacity: layouts.length > 0 ? 1 : 0,
      transform: [{ translateX: frame.x }],
      width: frame.width,
    };
  }, [layouts, position]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.indicator, animatedStyle, style]}
      testID={testID}
    />
  );
};

const styles = StyleSheet.create({
  indicator: {
    left: 0,
    position: 'absolute',
  },
});
