import React, { type ReactNode } from 'react';
import {
  Animated as NativeAnimated,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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

type NativeClockLayerProps = LayerProps & {
  /**
   * Drive presentation from the scroll host's NativeAnimated event clock.
   * Interactive children must use native hit testing (e.g. RNGH Pressable),
   * since Fabric's JS measurement can lag behind the native transform.
   */
  nativeScrollY?: NativeAnimated.Value;
};

const NativeLayerContentContext = React.createContext<ReactNode>(null);
const NativeLayerContent = () => React.useContext(NativeLayerContentContext);
const nativeLayerContent = <NativeLayerContent />;

// Business content updates through the context slot without rerendering the
// NativeAnimated host or replacing its graph. Never mirror scroll positions
// back as explicit JS styles: those events can lag the native presentation.
const NativeLayerView = React.memo(
  ({
    animatedStyle,
    pointerEvents,
    style,
    testID,
  }: Omit<LayerProps, 'children'> & {
    animatedStyle: React.ComponentProps<typeof NativeAnimated.View>['style'];
  }) => (
    <NativeAnimated.View
      pointerEvents={pointerEvents}
      style={[style, animatedStyle]}
      testID={testID}>
      {nativeLayerContent}
    </NativeAnimated.View>
  ),
);
NativeLayerView.displayName = 'NativeLayerView';

/**
 * Collapses with the header: `translateY = -min(scrollY, headerHeight)` and
 * fades out over the same distance.
 *
 * A negative offset (iOS rubber-band at the top) moves the layer down with the
 * content so the whole scene reads as one sheet instead of tearing apart.
 */
export const CollapsibleHeaderLayer = ({
  nativeScrollY,
  ...props
}: NativeClockLayerProps) =>
  nativeScrollY ? (
    <NativeCollapsibleHeaderLayer {...props} nativeScrollY={nativeScrollY} />
  ) : (
    <WorkletCollapsibleHeaderLayer {...props} />
  );

const NativeCollapsibleHeaderLayer = ({
  children,
  nativeScrollY,
  pointerEvents,
  style,
  testID,
}: LayerProps & { nativeScrollY: NativeAnimated.Value }) => {
  const { headerHeight } = useCollapsibleScene();
  const animatedStyle = React.useMemo(
    () => ({
      opacity:
        headerHeight > 0
          ? nativeScrollY.interpolate({
              inputRange: [0, headerHeight],
              outputRange: [1, 0],
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 1,
      transform: [
        {
          translateY:
            headerHeight > 0
              ? nativeScrollY.interpolate({
                  inputRange: [0, headerHeight],
                  outputRange: [0, -headerHeight],
                  // Overscroll must translate the header down with the list.
                  extrapolateLeft: 'extend',
                  extrapolateRight: 'clamp',
                })
              : 0,
        },
      ],
    }),
    [headerHeight, nativeScrollY],
  );
  return (
    <NativeLayerContentContext.Provider value={children}>
      <NativeLayerView
        animatedStyle={animatedStyle}
        pointerEvents={pointerEvents}
        style={style}
        testID={testID}
      />
    </NativeLayerContentContext.Provider>
  );
};

const WorkletCollapsibleHeaderLayer = ({
  children,
  pointerEvents,
  style,
  testID,
}: LayerProps) => {
  const { headerHeight, scrollY } = useCollapsibleScene();
  const animatedStyle = useAnimatedStyle(() => {
    const hidden = Math.min(scrollY.value, headerHeight);
    const visible = headerHeight > 0 ? 1 - hidden / headerHeight : 1;
    return {
      opacity: clamp(visible, 0, 1),
      // `-0` would fail style equality checks; keep the resting value exact.
      transform: [{ translateY: hidden === 0 ? 0 : -hidden }],
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
 *
 * Negative offsets (iOS rubber-band) translate below `baseTop` on purpose: the
 * pinned layer has to travel with the content it covers until the list settles.
 */
export const CollapsiblePinnedLayer = ({
  nativeScrollY,
  ...props
}: NativeClockLayerProps & { baseTop: number; pinTop?: number }) =>
  nativeScrollY ? (
    <NativeCollapsiblePinnedLayer {...props} nativeScrollY={nativeScrollY} />
  ) : (
    <WorkletCollapsiblePinnedLayer {...props} />
  );

const NativeCollapsiblePinnedLayer = ({
  baseTop,
  children,
  nativeScrollY,
  pinTop = 0,
  pointerEvents,
  style,
  testID,
}: LayerProps & { baseTop: number; pinTop?: number } & {
  nativeScrollY: NativeAnimated.Value;
}) => {
  const animatedStyle = React.useMemo(
    () => ({
      transform: [
        {
          translateY:
            baseTop > pinTop
              ? nativeScrollY.interpolate({
                  inputRange: [0, baseTop - pinTop],
                  outputRange: [baseTop, pinTop],
                  // Follow the rubber-band downwards; clamp once pinned.
                  extrapolateLeft: 'extend',
                  extrapolateRight: 'clamp',
                })
              : pinTop,
        },
      ],
    }),
    [baseTop, nativeScrollY, pinTop],
  );
  return (
    <NativeLayerContentContext.Provider value={children}>
      <NativeLayerView
        animatedStyle={animatedStyle}
        pointerEvents={pointerEvents}
        style={style}
        testID={testID}
      />
    </NativeLayerContentContext.Provider>
  );
};

const WorkletCollapsiblePinnedLayer = ({
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
          translateY: Math.max(pinTop, baseTop - scrollY.value),
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
