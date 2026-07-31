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
        useNativeDriver: false,
      }).start();
    },
    [animation],
  );

  const onScroll = useCallback(
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

  const headerHeight = useMemo(
    () =>
      animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, PERPS_PRO_HEADER_HEIGHT],
      }),
    [animation],
  );
  const headerOpacity = useMemo(
    () =>
      animation.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [0, 0, 1],
      }),
    [animation],
  );

  return {
    headerHeight,
    headerOpacity,
    onScroll,
  };
};
