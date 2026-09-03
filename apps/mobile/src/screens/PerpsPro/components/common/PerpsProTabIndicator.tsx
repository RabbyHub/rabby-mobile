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

export const PerpsProTabIndicator: React.FC<{
  layouts: readonly PerpsProTabIndicatorLayout[];
  position: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ layouts, position, style, testID }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const frame = getPerpsProTabIndicatorFrame(position.value, layouts);
    return {
      left: frame.x,
      opacity: layouts.length > 0 ? 1 : 0,
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
    position: 'absolute',
  },
});
