import {
  ANIMATION_STATUS,
  SCROLLABLE_STATUS,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

/** Mount inside the Android sheet: same-index keyboard moves skip onAnimate/onChange. */
export const PerpsProSheetKeyboardAnimation = ({
  onReadyChange,
}: {
  onReadyChange: (ready: boolean) => void;
}) => {
  const { animatedAnimationState, animatedScrollableStatus } =
    useBottomSheetInternal();
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      onReadyChange(false);
    };
  }, [onReadyChange]);
  const publishReady = useCallback(
    (ready: boolean) => {
      if (mountedRef.current) {
        onReadyChange(ready);
      }
    },
    [onReadyChange],
  );
  useAnimatedReaction(
    () =>
      animatedAnimationState.value.status === ANIMATION_STATUS.STOPPED &&
      animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED,
    (ready, previous) => {
      if (ready !== previous) {
        runOnJS(publishReady)(ready);
      }
    },
    [publishReady],
  );
  return null;
};
