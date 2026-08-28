import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import type { PerpsProAndroidCoordinatorProbeInput } from './contracts';
import { recordPerpsProPagerProbeCoordinatorState } from './runtime.nonprod';

export const usePerpsProAndroidCoordinatorProbe = ({
  controller,
  driverOffset,
  enabled,
  sessionActive,
  sessionEpoch,
  sessionTargetIndex,
  touchIntentState,
  visualOffset,
}: PerpsProAndroidCoordinatorProbeInput) => {
  useAnimatedReaction(
    () => {
      if (!enabled) {
        return {
          activeIndex: -1,
          driverOffset: 0,
          enabled: false,
          epoch: -1,
          maxOffset: 0,
          pageGestureActive: false,
          privateTouchIntent: -1,
          publicTouchIntent: 0,
          sessionActive: false,
          sessionEpoch: -1,
          sessionTargetIndex: -1,
          targetOffset: 0,
          touchSessionId: 0,
          visualOffset: 0,
        };
      }
      const activeIndex = controller.activeIndex.value;
      const target = controller.targets[activeIndex];
      return {
        activeIndex,
        driverOffset: driverOffset.value,
        enabled,
        epoch: controller.epoch.value,
        maxOffset: target?.maxOffset.value ?? 0,
        pageGestureActive: controller.pageGestureActive.value,
        privateTouchIntent: touchIntentState.value,
        publicTouchIntent: controller.touchIntent.value,
        sessionActive: sessionActive.value,
        sessionEpoch: sessionEpoch.value,
        sessionTargetIndex: sessionTargetIndex.value,
        targetOffset: target?.offset.value ?? 0,
        touchSessionId: controller.touchSessionId.value,
        visualOffset: visualOffset.value,
      };
    },
    (state, previous) => {
      const discreteStateChanged =
        !previous ||
        state.activeIndex !== previous.activeIndex ||
        state.enabled !== previous.enabled ||
        state.epoch !== previous.epoch ||
        state.pageGestureActive !== previous.pageGestureActive ||
        state.privateTouchIntent !== previous.privateTouchIntent ||
        state.publicTouchIntent !== previous.publicTouchIntent ||
        state.sessionActive !== previous.sessionActive ||
        state.sessionEpoch !== previous.sessionEpoch ||
        state.sessionTargetIndex !== previous.sessionTargetIndex ||
        state.touchSessionId !== previous.touchSessionId;
      if (discreteStateChanged) {
        if (typeof runOnJS === 'function') {
          runOnJS(recordPerpsProPagerProbeCoordinatorState)(state);
        } else {
          // Some unit-test Reanimated mocks execute reactions on the JS thread
          // without implementing runOnJS.
          recordPerpsProPagerProbeCoordinatorState(state);
        }
      }
    },
    [controller, enabled],
  );
};
