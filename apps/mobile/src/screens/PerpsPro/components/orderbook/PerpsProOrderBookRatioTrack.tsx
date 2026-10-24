import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useMemo, useState } from 'react';
import { Animated, View, type LayoutChangeEvent } from 'react-native';

import { usePerpsProOrderBookPercentAnimation } from './usePerpsProOrderBookPercentAnimation';

const GAP = 2;
const RADIUS = 2;

/** Only the reveal edges move: neither layout nor the colored corners scale. */
export const PerpsProOrderBookRatioTrack = React.memo(
  function PerpsProOrderBookRatioTrack({
    animationIdentity,
    buyPercent,
    hasValue,
  }: {
    animationIdentity: string;
    buyPercent: number;
    hasValue: boolean;
  }) {
    const { styles } = useTheme2024({ getStyle });
    const [width, setWidth] = useState(0);
    const percent = Number.isFinite(buyPercent)
      ? Math.max(0, Math.min(100, buyPercent))
      : 0;
    const animatedPercent = usePerpsProOrderBookPercentAnimation({
      // First measurement and resize snap to the current snapshot rather than
      // interpolating across differently sized tracks.
      animationIdentity: `${animationIdentity}|width:${width}`,
      hasValue,
      targetPercent: percent,
      valueIdentity: 'buy-ratio',
    });
    const onLayout = useCallback((event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.width;
      if (Number.isFinite(next) && next >= 0) {
        setWidth(previous => (previous === next ? previous : next));
      }
    }, []);
    const geometry = useMemo(() => {
      if (width <= GAP) {
        return null;
      }
      const available = width - GAP;
      const interpolate = (outputRange: number[], inputRange = [0, 100]) =>
        animatedPercent.interpolate({
          inputRange,
          outputRange,
          extrapolate: 'clamp',
        });
      const radius = Math.min(RADIUS, available);
      const threshold = (radius / available) * 100;
      const buyRadius =
        threshold === 100
          ? interpolate([0, radius])
          : interpolate([0, radius, radius], [0, threshold, 100]);
      const sellRadius =
        threshold === 100
          ? interpolate([radius, 0])
          : interpolate([radius, radius, 0], [0, 100 - threshold, 100]);
      return {
        buyClip: { transform: [{ translateX: interpolate([-width, -GAP]) }] },
        sellClip: { transform: [{ translateX: interpolate([GAP, width]) }] },
        buy: {
          transform: [{ translateX: interpolate([width, GAP]) }],
          borderTopLeftRadius: buyRadius,
          borderBottomLeftRadius: buyRadius,
        },
        sell: {
          transform: [{ translateX: interpolate([-GAP, -width]) }],
          borderTopRightRadius: sellRadius,
          borderBottomRightRadius: sellRadius,
        },
      };
    }, [animatedPercent, width]);

    return (
      <View
        onLayout={onLayout}
        pointerEvents="none"
        style={styles.track}
        testID="perps-pro-order-book-ratio-track">
        {!hasValue ? (
          <View style={styles.empty} />
        ) : geometry ? (
          <>
            <Animated.View
              collapsable={false}
              style={[styles.clip, geometry.buyClip]}
              testID="perps-pro-order-book-buy-ratio-clip">
              <Animated.View
                style={[styles.fill, styles.buy, geometry.buy]}
                testID="perps-pro-order-book-buy-ratio-track"
              />
            </Animated.View>
            <Animated.View
              collapsable={false}
              style={[styles.clip, geometry.sellClip]}
              testID="perps-pro-order-book-sell-ratio-clip">
              <Animated.View
                style={[styles.fill, styles.sell, geometry.sell]}
                testID="perps-pro-order-book-sell-ratio-track"
              />
            </Animated.View>
          </>
        ) : (
          // Preserve the original static layout before native width is known.
          <>
            <View
              style={[styles.buy, styles.staticFill, { flexGrow: percent }]}
              testID="perps-pro-order-book-buy-ratio-track"
            />
            <View
              style={[
                styles.sell,
                styles.staticFill,
                { flexGrow: 100 - percent },
              ]}
              testID="perps-pro-order-book-sell-ratio-track"
            />
          </>
        )}
      </View>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  track: {
    flex: 1,
    flexDirection: 'row',
    gap: GAP,
    height: 4,
    overflow: 'hidden',
  },
  // Full-width clips share the track's exact origin and pixel-rounded size.
  // Insetting them by GAP would introduce endpoint slivers at fractional DPR.
  clip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  staticFill: { flexBasis: 0 },
  buy: {
    backgroundColor: colors2024['green-default'],
    borderTopLeftRadius: RADIUS,
    borderBottomLeftRadius: RADIUS,
  },
  sell: {
    backgroundColor: colors2024['red-default'],
    borderTopRightRadius: RADIUS,
    borderBottomRightRadius: RADIUS,
  },
  empty: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: RADIUS,
    flex: 1,
  },
}));
