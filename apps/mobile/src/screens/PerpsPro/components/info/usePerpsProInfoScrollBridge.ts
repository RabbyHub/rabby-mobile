import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { useMemo } from 'react';
import type { FlatList } from 'react-native';
import {
  scrollTo,
  useAnimatedRef,
  useScrollViewOffset,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';

import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';

type PerpsProInfoScrollTarget = {
  maxOffset: SharedValue<number>;
  offset: SharedValue<number>;
  ref: AnimatedRef<FlatList<unknown>>;
};

export type PerpsProInfoScrollBridgeController = {
  activeIndex: SharedValue<number>;
  epoch: SharedValue<number>;
  pageGestureActive: SharedValue<boolean>;
  targets: readonly [
    PerpsProInfoScrollTarget,
    PerpsProInfoScrollTarget,
    PerpsProInfoScrollTarget,
  ];
};

export const getPerpsProInfoBridgeOffset = ({
  delta,
  maxOffset,
  offset,
}: {
  delta: number;
  maxOffset: number;
  offset: number;
}) => {
  'worklet';
  const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  const safeMaxOffset = Number.isFinite(maxOffset) ? Math.max(0, maxOffset) : 0;

  return Math.min(Math.max(safeOffset + safeDelta, 0), safeMaxOffset);
};

export const getPerpsProInfoScrollTarget = (
  controller: PerpsProInfoScrollBridgeController,
  tab: PerpsProInfoTab,
) => controller.targets[PERPS_PRO_INFO_TABS.indexOf(tab)];

export const scrollPerpsProInfoBridgeTarget = (
  controller: PerpsProInfoScrollBridgeController,
  index: number,
  offset: number,
) => {
  'worklet';
  const target = controller.targets[index];
  if (!target) {
    return;
  }
  scrollTo(target.ref, 0, offset, false);
};

export const interruptPerpsProInfoScrollBridge = (
  controller: PerpsProInfoScrollBridgeController,
) => {
  'worklet';
  controller.epoch.value += 1;
};

export const usePerpsProInfoScrollBridge = (
  initialTab: PerpsProInfoTab = 'positions',
) => {
  const positionsRef = useAnimatedRef<FlatList<unknown>>();
  const openOrdersRef = useAnimatedRef<FlatList<unknown>>();
  const accountRef = useAnimatedRef<FlatList<unknown>>();
  const positionsOffset = useSharedValue(0);
  const openOrdersOffset = useSharedValue(0);
  const accountOffset = useSharedValue(0);

  // Reanimated observes the native scroll tag and supports FlatList at runtime,
  // while this hook's public type is narrowed to Animated.ScrollView.
  useScrollViewOffset(positionsRef as never, positionsOffset);
  useScrollViewOffset(openOrdersRef as never, openOrdersOffset);
  useScrollViewOffset(accountRef as never, accountOffset);

  const positionsMaxOffset = useSharedValue(0);
  const openOrdersMaxOffset = useSharedValue(0);
  const accountMaxOffset = useSharedValue(0);
  const activeIndex = useSharedValue(
    Math.max(PERPS_PRO_INFO_TABS.indexOf(initialTab), 0),
  );
  const epoch = useSharedValue(0);
  const pageGestureActive = useSharedValue(false);

  return useMemo<PerpsProInfoScrollBridgeController>(
    () => ({
      activeIndex,
      epoch,
      pageGestureActive,
      targets: [
        {
          maxOffset: positionsMaxOffset,
          offset: positionsOffset,
          ref: positionsRef,
        },
        {
          maxOffset: openOrdersMaxOffset,
          offset: openOrdersOffset,
          ref: openOrdersRef,
        },
        {
          maxOffset: accountMaxOffset,
          offset: accountOffset,
          ref: accountRef,
        },
      ],
    }),
    [
      accountMaxOffset,
      accountOffset,
      accountRef,
      activeIndex,
      epoch,
      openOrdersMaxOffset,
      openOrdersOffset,
      openOrdersRef,
      pageGestureActive,
      positionsMaxOffset,
      positionsOffset,
      positionsRef,
    ],
  );
};
