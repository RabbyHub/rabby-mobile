import React from 'react';
import { Platform } from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { ApprovalsLayouts } from './layout';

const isIOS = Platform.OS === 'ios';
const FALLBACK_REFRESH_DISTANCE = 60;
const MIN_REFRESH_DISTANCE = 32;

export function useApprovalsPullTopGap() {
  const pullDownDistance = useSharedValue(0);
  const refreshDistance = useSharedValue(FALLBACK_REFRESH_DISTANCE);
  const maxPullDownDistance = useSharedValue(0);

  useAnimatedReaction(
    () => pullDownDistance.value,
    pullDistance => {
      if (pullDistance > maxPullDownDistance.value) {
        maxPullDownDistance.value = pullDistance;
      }
    },
  );

  const topGapStyle = useAnimatedStyle(() => {
    if (!isIOS) {
      return {
        height: ApprovalsLayouts.listTopGap,
      };
    }

    return {
      height: interpolate(
        pullDownDistance.value,
        [0, refreshDistance.value],
        [ApprovalsLayouts.listTopGap, 0],
        Extrapolate.CLAMP,
      ),
    };
  });

  const captureRefreshDistance = React.useCallback(() => {
    if (!isIOS) {
      return;
    }

    const nextRefreshDistance = maxPullDownDistance.value;
    if (nextRefreshDistance >= MIN_REFRESH_DISTANCE) {
      refreshDistance.value = nextRefreshDistance;
    }
    maxPullDownDistance.value = 0;
  }, [maxPullDownDistance, refreshDistance]);

  const ListTopGap = React.useMemo(
    () => <Animated.View style={topGapStyle} />,
    [topGapStyle],
  );

  return {
    pullDownDistance,
    ListTopGap,
    captureRefreshDistance,
  };
}
