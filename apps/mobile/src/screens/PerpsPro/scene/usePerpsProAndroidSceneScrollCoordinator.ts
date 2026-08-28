import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import { usePerpsProAndroidCoordinatorProbe } from '@/devtools/perpsProPagerProbe/coordinator';

import {
  getPerpsProInfoBridgeOffset,
  PERPS_PRO_INFO_TOUCH_INTENT,
  scrollPerpsProInfoBridgeTarget,
  type PerpsProInfoScrollBridgeController,
} from '../components/info/usePerpsProInfoScrollBridge';

const PERPS_PRO_ANDROID_SCENE_SCROLL_TOUCH_SLOP = 8;
const PERPS_PRO_ANDROID_SCENE_SCROLL_DIRECTION_RATIO = 1.2;
const PERPS_PRO_ANDROID_SCENE_SCROLL_SETTLE_VELOCITY = 0.01;

export type PerpsProAndroidSceneScrollIntent = 'activate' | 'fail' | 'pending';

export const getPerpsProAndroidSceneScrollIntent = ({
  deltaX,
  deltaY,
}: {
  deltaX: number;
  deltaY: number;
}): PerpsProAndroidSceneScrollIntent => {
  'worklet';
  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const absoluteX = Math.abs(safeDeltaX);
  const absoluteY = Math.abs(safeDeltaY);

  if (
    absoluteX >= PERPS_PRO_ANDROID_SCENE_SCROLL_TOUCH_SLOP &&
    absoluteX > absoluteY * PERPS_PRO_ANDROID_SCENE_SCROLL_DIRECTION_RATIO
  ) {
    return 'fail';
  }
  if (
    absoluteY >= PERPS_PRO_ANDROID_SCENE_SCROLL_TOUCH_SLOP &&
    absoluteY >= absoluteX * PERPS_PRO_ANDROID_SCENE_SCROLL_DIRECTION_RATIO
  ) {
    return 'activate';
  }
  return 'pending';
};

export const getPerpsProAndroidSceneScrollVelocity = (velocityY: number) => {
  'worklet';
  return Number.isFinite(velocityY) ? -velocityY : 0;
};

export const usePerpsProAndroidSceneScrollCoordinator = ({
  controller,
  enabled,
}: {
  controller: PerpsProInfoScrollBridgeController;
  enabled: boolean;
}) => {
  const driverOffset = useSharedValue(0);
  const visualOffset = useSharedValue(0);
  const sessionActive = useSharedValue(false);
  const sessionEpoch = useSharedValue(-1);
  const sessionTargetIndex = useSharedValue(-1);
  const touchIntentState = useSharedValue(-1);
  const touchStartAbsoluteX = useSharedValue(0);
  const touchStartAbsoluteY = useSharedValue(0);
  const lastAbsoluteY = useSharedValue(0);

  useAnimatedReaction(
    () => {
      if (!enabled) {
        return {
          activeIndex: -1,
          enabled: false,
          epoch: -1,
          maxOffset: 0,
          targetOffset: 0,
        };
      }
      const activeIndex = controller.activeIndex.value;
      const target = controller.targets[activeIndex];
      return {
        activeIndex,
        enabled,
        epoch: controller.epoch.value,
        maxOffset: target?.maxOffset.value ?? 0,
        targetOffset: target?.offset.value ?? 0,
      };
    },
    state => {
      if (
        sessionActive.value &&
        (!state.enabled ||
          state.activeIndex !== sessionTargetIndex.value ||
          state.epoch !== sessionEpoch.value)
      ) {
        cancelAnimation(driverOffset);
        sessionActive.value = false;
      }

      if (sessionActive.value) {
        return;
      }
      if (touchIntentState.value === 0) {
        return;
      }

      const nextOffset = getPerpsProInfoBridgeOffset({
        delta: 0,
        maxOffset: state.maxOffset,
        offset: state.targetOffset,
      });
      driverOffset.value = nextOffset;
      visualOffset.value = nextOffset;
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
      visualOffset.value = nextOffset;
      scrollPerpsProInfoBridgeTarget(
        controller,
        sessionTargetIndex.value,
        nextOffset,
      );
    },
    [controller],
  );

  usePerpsProAndroidCoordinatorProbe({
    controller,
    driverOffset,
    enabled,
    sessionActive,
    sessionEpoch,
    sessionTargetIndex,
    touchIntentState,
    visualOffset,
  });

  const gesture = useMemo(
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
          controller.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
          controller.touchSessionId.value += 1;
          controller.horizontalTouchSessionId.value = 0;
          driverOffset.value = visualOffset.value;
          controller.epoch.value += 1;

          const touch = event.allTouches[0];
          const index = controller.activeIndex.value;
          if (
            !enabled ||
            !touch ||
            controller.pageGestureActive.value ||
            !controller.targets[index]
          ) {
            touchIntentState.value = -1;
            controller.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
            stateManager.fail();
            return;
          }

          touchStartAbsoluteX.value = touch.absoluteX;
          touchStartAbsoluteY.value = touch.absoluteY;
          lastAbsoluteY.value = touch.absoluteY;
        })
        .onTouchesMove((event, stateManager) => {
          'worklet';
          if (touchIntentState.value !== 0) {
            return;
          }
          const touch = event.allTouches[0];
          if (!touch) {
            touchIntentState.value = -1;
            controller.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
            stateManager.fail();
            return;
          }

          const intent = getPerpsProAndroidSceneScrollIntent({
            deltaX: touch.absoluteX - touchStartAbsoluteX.value,
            deltaY: touch.absoluteY - touchStartAbsoluteY.value,
          });
          if (intent === 'fail') {
            touchIntentState.value = -1;
            controller.touchIntent.value =
              PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
            controller.horizontalTouchSessionId.value =
              controller.touchSessionId.value;
            stateManager.fail();
          } else if (intent === 'activate') {
            touchIntentState.value = 1;
            controller.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.vertical;
            stateManager.activate();
          }
        })
        .onStart(event => {
          'worklet';
          const index = controller.activeIndex.value;
          const target = controller.targets[index];
          if (
            !target ||
            controller.touchIntent.value !==
              PERPS_PRO_INFO_TOUCH_INTENT.vertical
          ) {
            sessionActive.value = false;
            return;
          }

          const offset = getPerpsProInfoBridgeOffset({
            delta: 0,
            maxOffset: target.maxOffset.value,
            offset: visualOffset.value,
          });
          driverOffset.value = offset;
          visualOffset.value = offset;
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
          const targetIndex = sessionTargetIndex.value;
          const target = controller.targets[targetIndex];
          if (!target) {
            sessionActive.value = false;
            return;
          }

          const velocity = getPerpsProAndroidSceneScrollVelocity(
            event.velocityY,
          );
          if (
            Math.abs(velocity) <= PERPS_PRO_ANDROID_SCENE_SCROLL_SETTLE_VELOCITY
          ) {
            sessionActive.value = false;
            return;
          }
          const decayEpoch = sessionEpoch.value;
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
              if (
                controller.epoch.value === decayEpoch &&
                sessionTargetIndex.value === targetIndex
              ) {
                sessionActive.value = false;
              }
            },
          );
        })
        .onFinalize((_event, success) => {
          'worklet';
          if (!success) {
            cancelAnimation(driverOffset);
            sessionActive.value = false;
          }
          if (
            controller.touchIntent.value !==
            PERPS_PRO_INFO_TOUCH_INTENT.horizontal
          ) {
            controller.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
          }
          touchIntentState.value = -1;
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
      visualOffset,
    ],
  );

  return { gesture, visualOffset };
};
