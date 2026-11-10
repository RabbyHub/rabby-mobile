import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, useAnimatedValue } from 'react-native';

import type { PerpsViewMode } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { PERPS_HEADER_HEIGHT } from '../PerpsShared/constants';

export type PerpsRootHeaderAnimatedStyle = React.ComponentProps<
  typeof Animated.View
>['style'];

/** One native vertical graph shared by fixed controls and the moving Pro wash. */
export function usePerpsRootHeaderPresentation(
  nativeScrollY: Animated.Value,
  settledMode: PerpsViewMode,
) {
  const weight = useAnimatedValue(settledMode === 'pro' ? 1 : 0);
  const previousMode = useRef(settledMode);
  useEffect(() => {
    if (previousMode.current === settledMode) {
      return;
    }
    previousMode.current = settledMode;
    const animation = Animated.timing(weight, {
      toValue: settledMode === 'pro' ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [settledMode, weight]);

  return useMemo(() => {
    const collapse = nativeScrollY.interpolate({
      inputRange: [0, PERPS_HEADER_HEIGHT],
      outputRange: [0, PERPS_HEADER_HEIGHT],
      extrapolate: 'clamp',
    });
    const hidden = Animated.multiply(collapse, weight);
    const transform = [{ translateY: Animated.multiply(hidden, -1) }];
    return {
      headerStyle: {
        opacity: hidden.interpolate({
          inputRange: [0, PERPS_HEADER_HEIGHT],
          outputRange: [1, 0],
          extrapolate: 'clamp',
        }),
        transform,
      },
      // Do not fade the wash: pinned market text must not bleed through while
      // the controls fade. Fully collapsed, both move out of their safe-top clip.
      backdropStyle: { ...StyleSheet.absoluteFillObject, transform },
    };
  }, [nativeScrollY, weight]);
}

function ProSurfaceColor() {
  const { colors2024 } = useTheme2024();
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors2024['neutral-bg-1'] },
      ]}
      testID="perps-pro-header-wash-color"
    />
  );
}
const proSurfaceColor = <ProSurfaceColor />;
const NativeProHeaderWash = memo(function NativeProHeaderWash({
  animatedStyle,
}: {
  animatedStyle: PerpsRootHeaderAnimatedStyle;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={animatedStyle}
      testID="perps-pro-header-wash">
      {proSurfaceColor}
    </Animated.View>
  );
});

/**
 * Inside the Pro Root page, above its pinned market. Horizontal motion is
 * inherited from that page's real ancestor, never copied into another track.
 * Simple needs no wash: its fixed header placeholder already exposes its bg0.
 */
export const PerpsProRootHeaderWash = memo(function PerpsProRootHeaderWash({
  animatedStyle,
}: {
  animatedStyle: PerpsRootHeaderAnimatedStyle;
}) {
  const { safeTop } = useSafeSizes();
  return (
    <View
      pointerEvents="none"
      style={[styles.clip, { top: safeTop }]}
      testID="perps-pro-header-wash-clip">
      <NativeProHeaderWash animatedStyle={animatedStyle} />
    </View>
  );
});

const styles = StyleSheet.create({
  clip: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PERPS_HEADER_HEIGHT,
    overflow: 'hidden',
  },
});
