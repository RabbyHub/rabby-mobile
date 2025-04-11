import { ANIMATION_STATE, useBottomSheetInternal } from '@gorhom/bottom-sheet';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';

export const useBottomSheetOpenEnd = (onOpenEnd: () => void) => {
  const bsInternal = useBottomSheetInternal(true);

  useAnimatedReaction(
    () => bsInternal?.animatedPosition.value,
    () => {
      if (
        bsInternal?.animatedAnimationState.value === ANIMATION_STATE.STOPPED
      ) {
        runOnJS(onOpenEnd)();
      }
    },
    [],
  );
};
