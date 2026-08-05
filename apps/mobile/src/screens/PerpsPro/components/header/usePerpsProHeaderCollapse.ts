import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { PERPS_PRO_HEADER_HEIGHT } from './constants';

export const PERPS_PRO_HEADER_SCROLL_THRESHOLD = 12;
const PERPS_PRO_HEADER_TOP_TOLERANCE = 1;
const PERPS_PRO_HEADER_ANIMATION_MS = 160;

export type PerpsProHeaderScrollState = {
  accumulatedDelta: number;
  lastOffset: number;
  visible: boolean;
};

export interface PerpsProHeaderGeometry {
  headerOpacity: number;
  headerTranslateY: number;
  marketTranslateY: number;
}

export const getPerpsProHeaderGeometry = (
  rawOffset: number,
  rawVisibilityProgress: number,
): PerpsProHeaderGeometry => {
  const offset = Number.isFinite(rawOffset)
    ? Math.min(Math.max(rawOffset, 0), PERPS_PRO_HEADER_HEIGHT)
    : 0;
  const visibilityProgress = Number.isFinite(rawVisibilityProgress)
    ? Math.min(Math.max(rawVisibilityProgress, 0), 1)
    : 1;
  const hiddenDistance = offset * (1 - visibilityProgress);

  return {
    headerOpacity: 1 - hiddenDistance / PERPS_PRO_HEADER_HEIGHT,
    headerTranslateY: hiddenDistance === 0 ? 0 : -hiddenDistance,
    marketTranslateY: PERPS_PRO_HEADER_HEIGHT - hiddenDistance,
  };
};

export const getNextPerpsProHeaderScrollState = (
  state: PerpsProHeaderScrollState,
  rawOffset: number,
): PerpsProHeaderScrollState => {
  if (!Number.isFinite(rawOffset)) {
    return state;
  }

  const offset = Math.max(0, rawOffset);
  if (offset <= PERPS_PRO_HEADER_TOP_TOLERANCE) {
    return {
      accumulatedDelta: 0,
      lastOffset: offset,
      visible: true,
    };
  }

  const delta = offset - state.lastOffset;
  const accumulatedDelta =
    delta === 0
      ? state.accumulatedDelta
      : state.accumulatedDelta * delta < 0
      ? delta
      : state.accumulatedDelta + delta;

  if (accumulatedDelta >= PERPS_PRO_HEADER_SCROLL_THRESHOLD) {
    return {
      accumulatedDelta: 0,
      lastOffset: offset,
      visible: false,
    };
  }
  if (accumulatedDelta <= -PERPS_PRO_HEADER_SCROLL_THRESHOLD) {
    return {
      accumulatedDelta: 0,
      lastOffset: offset,
      visible: true,
    };
  }
  return {
    accumulatedDelta,
    lastOffset: offset,
    visible: state.visible,
  };
};

export const usePerpsProHeaderCollapse = () => {
  const animation = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollStateRef = useRef<PerpsProHeaderScrollState>({
    accumulatedDelta: 0,
    lastOffset: 0,
    visible: true,
  });

  useEffect(
    () => () => {
      animation.stopAnimation();
    },
    [animation],
  );

  const setHeaderVisible = useCallback(
    (visible: boolean) => {
      Animated.timing(animation, {
        duration: PERPS_PRO_HEADER_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        toValue: visible ? 1 : 0,
        useNativeDriver: true,
      }).start();
    },
    [animation],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const current = scrollStateRef.current;
      const next = getNextPerpsProHeaderScrollState(
        current,
        event.nativeEvent.contentOffset.y,
      );
      scrollStateRef.current = next;
      if (next.visible !== current.visible) {
        setHeaderVisible(next.visible);
      }
    },
    [setHeaderVisible],
  );

  const onScroll = useMemo(
    () =>
      Animated.event(
        [
          {
            nativeEvent: {
              contentOffset: { y: scrollY },
            },
          },
        ],
        {
          listener: handleScroll,
          useNativeDriver: true,
        },
      ),
    [handleScroll, scrollY],
  );
  const clampedScrollY = useMemo(
    () =>
      scrollY.interpolate({
        extrapolate: 'clamp',
        inputRange: [0, PERPS_PRO_HEADER_HEIGHT],
        outputRange: [0, PERPS_PRO_HEADER_HEIGHT],
      }),
    [scrollY],
  );
  const hiddenDistance = useMemo(
    () => Animated.multiply(clampedScrollY, Animated.subtract(1, animation)),
    [animation, clampedScrollY],
  );
  const headerTranslateY = useMemo(
    () => Animated.multiply(hiddenDistance, -1),
    [hiddenDistance],
  );
  const marketTranslateY = useMemo(
    () => Animated.subtract(PERPS_PRO_HEADER_HEIGHT, hiddenDistance),
    [hiddenDistance],
  );
  const headerOpacity = useMemo(
    () =>
      hiddenDistance.interpolate({
        extrapolate: 'clamp',
        inputRange: [0, PERPS_PRO_HEADER_HEIGHT],
        outputRange: [1, 0],
      }),
    [hiddenDistance],
  );

  return {
    headerOpacity,
    headerTranslateY,
    marketTranslateY,
    onScroll,
  };
};
