import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { useLayoutEffect, useMemo } from 'react';
import type { FlatList } from 'react-native';
import {
  runOnUI,
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

export const PERPS_PRO_INFO_TOUCH_INTENT = {
  horizontal: 3,
  idle: 0,
  pending: 1,
  vertical: 2,
} as const;

export type PerpsProInfoTouchIntent =
  (typeof PERPS_PRO_INFO_TOUCH_INTENT)[keyof typeof PERPS_PRO_INFO_TOUCH_INTENT];

export type PerpsProInfoScrollBridgeController = {
  activeIndex: SharedValue<number>;
  epoch: SharedValue<number>;
  horizontalTouchSessionId: SharedValue<number>;
  pageGestureActive: SharedValue<boolean>;
  touchIntent: SharedValue<PerpsProInfoTouchIntent>;
  touchSessionId: SharedValue<number>;
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
  activeTab: PerpsProInfoTab = 'positions',
) => {
  const positionsRef = useAnimatedRef<FlatList<unknown>>();
  const openOrdersRef = useAnimatedRef<FlatList<unknown>>();
  const accountRef = useAnimatedRef<FlatList<unknown>>();
  const positionsOffset = useSharedValue(0);
  const openOrdersOffset = useSharedValue(0);
  const accountOffset = useSharedValue(0);

  // The single native list moves between these refs without unmounting.
  // Animated refs retain their old native tag when detached, so explicitly
  // stop observing inactive refs instead of letting all visited tabs follow
  // the same list. Keep each provided offset fixed: useScrollViewOffset retains
  // the first shared value passed to that hook instance.
  useScrollViewOffset(
    activeTab === 'positions' ? (positionsRef as never) : null,
    positionsOffset,
  );
  useScrollViewOffset(
    activeTab === 'openOrders' ? (openOrdersRef as never) : null,
    openOrdersOffset,
  );
  useScrollViewOffset(
    activeTab === 'account' ? (accountRef as never) : null,
    accountOffset,
  );

  const positionsMaxOffset = useSharedValue(0);
  const openOrdersMaxOffset = useSharedValue(0);
  const accountMaxOffset = useSharedValue(0);
  const nextActiveIndex = Math.max(PERPS_PRO_INFO_TABS.indexOf(activeTab), 0);
  const activeIndex = useSharedValue(nextActiveIndex);
  const epoch = useSharedValue(0);
  const horizontalTouchSessionId = useSharedValue(0);
  const pageGestureActive = useSharedValue(false);
  const touchIntent = useSharedValue<PerpsProInfoTouchIntent>(
    PERPS_PRO_INFO_TOUCH_INTENT.idle,
  );
  const touchSessionId = useSharedValue(0);

  const controller = useMemo<PerpsProInfoScrollBridgeController>(
    () => ({
      activeIndex,
      epoch,
      horizontalTouchSessionId,
      pageGestureActive,
      touchIntent,
      touchSessionId,
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
      horizontalTouchSessionId,
      openOrdersMaxOffset,
      openOrdersOffset,
      openOrdersRef,
      pageGestureActive,
      positionsMaxOffset,
      positionsOffset,
      positionsRef,
      touchIntent,
      touchSessionId,
    ],
  );

  useLayoutEffect(() => {
    runOnUI((nextIndex: number) => {
      'worklet';
      const previousIndex = controller.activeIndex.value;
      if (previousIndex === nextIndex) {
        return;
      }
      const previous = controller.targets[previousIndex];
      const next = controller.targets[nextIndex];
      // Tab changes preserve the one list's current native offset. Seed it
      // before selecting the new target, even when an unchanged native offset
      // emits no new scroll event. Its maxOffset belongs to its own new layout.
      const offset = previous?.offset.value ?? 0;
      next.offset.value = Number.isFinite(offset) ? Math.max(0, offset) : 0;
      controller.activeIndex.value = nextIndex;
    })(nextActiveIndex);
  }, [controller, nextActiveIndex]);

  return controller;
};
