import { ScrollHandlerProps } from '@/components/customized/react-native-collapsible-tab-view/hooks';
import { RNGHScrollView } from '@/components/customized/reexports';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { zCreate } from '@/core/utils/reexports';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { triggerImpact } from '@/utils/common';
import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import {
  Dimensions,
  PanResponder,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
// import { useTabsContext } from 'react-native-collapsible-tab-view/src/hooks';
import { Gesture } from 'react-native-gesture-handler';
// import {
//   GestureStateManager,
//   GestureStateManagerType,
// } from 'react-native-gesture-handler/src/handlers/gestures/gestureStateManager';
import {
  clamp,
  Extrapolate,
  interpolate,
  makeMutable,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const SCROLLABLE_STATUS = {
  LOCKED: 'LOCKED',
  UNLOCKED: 'UNLOCKED',
} as const;

export type SCROLLABLE_STATUS =
  (typeof SCROLLABLE_STATUS)[keyof typeof SCROLLABLE_STATUS];

export const SCROLLABLE_DECELERATION_RATE_MAPPER = {
  [SCROLLABLE_STATUS.LOCKED]: 0,
  [SCROLLABLE_STATUS.UNLOCKED]: Platform.select({
    ios: 0.998,
    android: 0.985,
    default: 1,
  }),
};

const PULL_THRESHOLD = 100;
const scrWinHeight = Dimensions.get('screen').height;

// export const THRESHOLD_PERCENT = (PULL_THRESHOLD / scrWinHeight) * 100;
export const THRESHOLD_PERCENT = 8;

export function getPullThreshold(height: number = scrWinHeight) {
  'worklet';
  // return Math.min(height * 0.3, PULL_THRESHOLD);
  return Math.min(height * THRESHOLD_PERCENT * 0.01 + 16, PULL_THRESHOLD);
}

export const homeDrawerAnimateMutable = {
  tabsOpacity: makeMutable(0),
  pullPercent: makeMutable(0),
  isExpanded: makeMutable(false),
  translateY: makeMutable(0),

  scrollViewContentHeight: makeMutable(0),
  scrollViewLayoutHeight: makeMutable(0),
  swipeUpHintHeight: makeMutable(0),
};

export function getScrollContainerPb(bottomInset: number) {
  'worklet';
  return IS_ANDROID ? Math.max(bottomInset, 16) : bottomInset;
}
