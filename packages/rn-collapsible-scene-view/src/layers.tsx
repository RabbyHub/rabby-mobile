import React, { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { useCollapsibleScene } from './context';

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

type LayerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none';
};

/**
 * Collapses with the header: `translateY = -min(scrollY, headerHeight)` and
 * fades out over the same distance.
 */
export const CollapsibleHeaderLayer = ({
  children,
  pointerEvents,
  style,
  testID,
}: LayerProps) => {
  const { headerHeight, scrollY } = useCollapsibleScene();
  const animatedStyle = useAnimatedStyle(() => {
    const hidden = clamp(scrollY.value, 0, headerHeight);
    return {
      opacity: headerHeight > 0 ? 1 - hidden / headerHeight : 1,
      transform: [{ translateY: hidden > 0 ? -hidden : 0 }],
    };
  }, [headerHeight]);

  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[style, animatedStyle]}
      testID={testID}>
      {children}
    </Animated.View>
  );
};

/**
 * Pins at `pinTop` after `baseTop` distance of scrolling:
 * `translateY = max(pinTop, baseTop - scrollY)`.
 *
 * `pinTop` defaults to 0 (the top edge). A layer that must stack below another
 * pinned layer passes that layer's bottom edge instead.
 */
export const CollapsiblePinnedLayer = ({
  baseTop,
  children,
  pinTop = 0,
  pointerEvents,
  style,
  testID,
}: LayerProps & { baseTop: number; pinTop?: number }) => {
  const { scrollY } = useCollapsibleScene();
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateY: Math.max(pinTop, baseTop - Math.max(scrollY.value, 0)),
        },
      ],
    }),
    [baseTop, pinTop],
  );

  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[style, animatedStyle]}
      testID={testID}>
      {children}
    </Animated.View>
  );
};

/**
 * Scrolls away with the content: it follows the list exactly, so it never
 * "sticks" even though it lives above the pinned layers.
 */
export const CollapsibleScrollingLayer = ({
  baseTop,
  children,
  pointerEvents,
  style,
  testID,
}: LayerProps & { baseTop: number }) => {
  const { scrollY } = useCollapsibleScene();
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: baseTop - scrollY.value }],
    }),
    [baseTop],
  );

  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[style, animatedStyle]}
      testID={testID}>
      {children}
    </Animated.View>
  );
};

/**
 * Convenience for a layer that fades with the collapse distance, e.g. the
 * header content itself.
 */
export const useCollapseProgress = () => {
  const { headerHeight, scrollY } = useCollapsibleScene();
  const style = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        scrollY.value,
        [0, headerHeight],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    }),
    [headerHeight],
  );
  return style;
};
