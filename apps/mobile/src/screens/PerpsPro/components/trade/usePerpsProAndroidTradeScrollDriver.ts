import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import {
  getPerpsProInfoBridgeOffset,
  scrollPerpsProInfoBridgeTarget,
  stopPerpsProInfoBridgeTargetMomentum,
  type PerpsProInfoScrollBridgeController,
} from '../info/usePerpsProInfoScrollBridge';

const PERPS_PRO_ANDROID_TRADE_SCROLL_TOUCH_SLOP = 8;
const PERPS_PRO_ANDROID_TRADE_SCROLL_DIRECTION_RATIO = 1.2;
const PERPS_PRO_ANDROID_TRADE_SCROLL_SETTLE_VELOCITY = 0.01;

export type PerpsProAndroidTradeScrollIntent = 'activate' | 'fail' | 'pending';

export const getPerpsProAndroidTradeScrollIntent = ({
  deltaX,
  deltaY,
}: {
  deltaX: number;
  deltaY: number;
}): PerpsProAndroidTradeScrollIntent => {
  'worklet';
  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const absoluteX = Math.abs(safeDeltaX);
  const absoluteY = Math.abs(safeDeltaY);

  if (
    absoluteX >= PERPS_PRO_ANDROID_TRADE_SCROLL_TOUCH_SLOP &&
    absoluteX > absoluteY * PERPS_PRO_ANDROID_TRADE_SCROLL_DIRECTION_RATIO
  ) {
    return 'fail';
  }
  if (
    absoluteY >= PERPS_PRO_ANDROID_TRADE_SCROLL_TOUCH_SLOP &&
    absoluteY >= absoluteX * PERPS_PRO_ANDROID_TRADE_SCROLL_DIRECTION_RATIO
  ) {
    return 'activate';
  }
  return 'pending';
};

export const getPerpsProAndroidTradeScrollVelocity = (velocityY: number) => {
  'worklet';
  return Number.isFinite(velocityY) ? -velocityY : 0;
};

export const usePerpsProAndroidTradeScrollDriver = ({
  controller,
  enabled,
}: {
  controller: PerpsProInfoScrollBridgeController;
  enabled: boolean;
}) => {
  const driverOffset = useSharedValue(0);
  const sessionActive = useSharedValue(false);
  const sessionEpoch = useSharedValue(-1);
  const sessionTargetIndex = useSharedValue(-1);
  const touchIntentState = useSharedValue(0);
  const touchStartAbsoluteX = useSharedValue(0);
  const touchStartAbsoluteY = useSharedValue(0);
  const lastAbsoluteY = useSharedValue(0);

  useAnimatedReaction(
    () => ({
      activeIndex: controller.activeIndex.value,
      enabled,
      epoch: controller.epoch.value,
      pageGestureActive: controller.pageGestureActive.value,
    }),
    state => {
      if (!sessionActive.value) {
        return;
      }
      if (
        !state.enabled ||
        state.pageGestureActive ||
        state.activeIndex !== sessionTargetIndex.value ||
        state.epoch !== sessionEpoch.value
      ) {
        cancelAnimation(driverOffset);
        sessionActive.value = false;
      }
    },
    [controller, enabled],
  );

  useAnimatedReaction(
    () => driverOffset.value,
    offset => {
      if (!sessionActive.value) {
        return;
      }
      if (
        controller.pageGestureActive.value ||
        controller.activeIndex.value !== sessionTargetIndex.value ||
        controller.epoch.value !== sessionEpoch.value
      ) {
        cancelAnimation(driverOffset);
        sessionActive.value = false;
        return;
      }

      const target = controller.targets[sessionTargetIndex.value];
      if (!target) {
        cancelAnimation(driverOffset);
        sessionActive.value = false;
        return;
      }
      const nextOffset = getPerpsProInfoBridgeOffset({
        delta: 0,
        maxOffset: target.maxOffset.value,
        offset,
      });
      if (nextOffset !== offset) {
        cancelAnimation(driverOffset);
        driverOffset.value = nextOffset;
      }
      scrollPerpsProInfoBridgeTarget(
        controller,
        sessionTargetIndex.value,
        nextOffset,
      );
    },
    [controller],
  );

  return useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .onTouchesDown((event, stateManager) => {
          'worklet';
          cancelAnimation(driverOffset);
          sessionActive.value = false;
          touchIntentState.value = 0;

          const touch = event.allTouches[0];
          const index = controller.activeIndex.value;
          if (
            !enabled ||
            !touch ||
            controller.pageGestureActive.value ||
            !controller.targets[index]
          ) {
            touchIntentState.value = -1;
            stateManager.fail();
            return;
          }

          touchStartAbsoluteX.value = touch.absoluteX;
          touchStartAbsoluteY.value = touch.absoluteY;
          lastAbsoluteY.value = touch.absoluteY;
          stopPerpsProInfoBridgeTargetMomentum(controller, index);
        })
        .onTouchesMove((event, stateManager) => {
          'worklet';
          if (touchIntentState.value !== 0) {
            return;
          }
          const touch = event.allTouches[0];
          if (!touch || controller.pageGestureActive.value) {
            touchIntentState.value = -1;
            stateManager.fail();
            return;
          }

          const intent = getPerpsProAndroidTradeScrollIntent({
            deltaX: touch.absoluteX - touchStartAbsoluteX.value,
            deltaY: touch.absoluteY - touchStartAbsoluteY.value,
          });
          if (intent === 'fail') {
            touchIntentState.value = -1;
            stateManager.fail();
          } else if (intent === 'activate') {
            touchIntentState.value = 1;
            stateManager.activate();
          }
        })
        .onStart(event => {
          'worklet';
          const index = controller.activeIndex.value;
          const target = controller.targets[index];
          if (!target || controller.pageGestureActive.value) {
            sessionActive.value = false;
            return;
          }

          driverOffset.value = getPerpsProInfoBridgeOffset({
            delta: 0,
            maxOffset: target.maxOffset.value,
            offset: target.offset.value,
          });
          lastAbsoluteY.value = event.absoluteY;
          sessionEpoch.value = controller.epoch.value;
          sessionTargetIndex.value = index;
          sessionActive.value = true;
        })
        .onUpdate(event => {
          'worklet';
          if (!sessionActive.value) {
            return;
          }
          const target = controller.targets[sessionTargetIndex.value];
          if (
            !target ||
            controller.pageGestureActive.value ||
            controller.activeIndex.value !== sessionTargetIndex.value ||
            controller.epoch.value !== sessionEpoch.value
          ) {
            cancelAnimation(driverOffset);
            sessionActive.value = false;
            return;
          }

          const delta = lastAbsoluteY.value - event.absoluteY;
          lastAbsoluteY.value = event.absoluteY;
          const nextOffset = getPerpsProInfoBridgeOffset({
            delta,
            maxOffset: target.maxOffset.value,
            offset: driverOffset.value,
          });
          if (nextOffset !== driverOffset.value) {
            driverOffset.value = nextOffset;
          }
        })
        .onEnd(event => {
          'worklet';
          if (!sessionActive.value) {
            return;
          }
          const target = controller.targets[sessionTargetIndex.value];
          if (!target) {
            sessionActive.value = false;
            return;
          }

          const velocity = getPerpsProAndroidTradeScrollVelocity(
            event.velocityY,
          );
          if (
            Math.abs(velocity) <= PERPS_PRO_ANDROID_TRADE_SCROLL_SETTLE_VELOCITY
          ) {
            sessionActive.value = false;
            return;
          }
          driverOffset.value = withDecay(
            {
              clamp: [
                0,
                Number.isFinite(target.maxOffset.value)
                  ? Math.max(target.maxOffset.value, 0)
                  : 0,
              ],
              velocity,
            },
            () => {
              sessionActive.value = false;
            },
          );
        })
        .onFinalize((_event, success) => {
          'worklet';
          if (!success) {
            cancelAnimation(driverOffset);
            sessionActive.value = false;
          }
          touchIntentState.value = 0;
        }),
    [
      controller,
      driverOffset,
      enabled,
      lastAbsoluteY,
      sessionActive,
      sessionEpoch,
      sessionTargetIndex,
      touchIntentState,
      touchStartAbsoluteX,
      touchStartAbsoluteY,
    ],
  );
};
