import { useEffect, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { AccountRemovingVisualStage } from '@/store/account';

export const DELETE_FINISH_DURATION_MS = 280;
const DELETE_PENDING_MIN_OPACITY = 0.42;
const DELETE_PENDING_MAX_OPACITY = 0.82;
const DELETE_PENDING_PULSE_DURATION_MS = 420;

export type DeletingVisualStage = AccountRemovingVisualStage;
type DeletingVisualStageInput =
  | DeletingVisualStage
  | boolean
  | SharedValue<DeletingVisualStage>;

const isDeletingVisualStageSV = (
  value: DeletingVisualStageInput,
): value is SharedValue<DeletingVisualStage> => {
  return typeof value === 'object' && value !== null && 'value' in value;
};

const resolveDeletingVisualStage = (
  value: DeletingVisualStage | boolean,
): DeletingVisualStage => {
  'worklet';

  if (typeof value === 'boolean') {
    return value ? 'deleting' : 'idle';
  }

  return value;
};

export function useDeletingOpacity(
  stage: DeletingVisualStageInput,
  onFinish?: () => void,
) {
  const opacity = useSharedValue(1);
  const stageSV = useSharedValue<DeletingVisualStage>(
    resolveDeletingVisualStage(
      isDeletingVisualStageSV(stage) ? stage.value : stage,
    ),
  );
  const onFinishRef = useRef(onFinish);
  const isStageSV = isDeletingVisualStageSV(stage);

  const invokeOnFinish = () => {
    onFinishRef.current?.();
  };

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (isStageSV) {
      return;
    }

    stageSV.value = resolveDeletingVisualStage(
      stage as DeletingVisualStage | boolean,
    );
  }, [isStageSV, stage, stageSV]);

  useAnimatedReaction(
    () => {
      if (!isStageSV) {
        return null;
      }

      return resolveDeletingVisualStage(
        (stage as SharedValue<DeletingVisualStage>).value,
      );
    },
    nextStage => {
      if (nextStage === null) {
        return;
      }

      stageSV.value = nextStage;
    },
  );

  useAnimatedReaction(
    () => stageSV.value,
    (resolvedStage, prevStage) => {
      if (resolvedStage === prevStage) {
        return;
      }

      cancelAnimation(opacity);

      if (resolvedStage === 'idle') {
        opacity.value = withTiming(1, { duration: 140 });
        return;
      }

      if (resolvedStage === 'finishing') {
        opacity.value = withTiming(
          0,
          {
            duration: DELETE_FINISH_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          },
          finished => {
            if (finished && onFinishRef.current) {
              runOnJS(invokeOnFinish)();
            }
          },
        );
        return;
      }

      opacity.value = DELETE_PENDING_MAX_OPACITY;
      opacity.value = withRepeat(
        withSequence(
          withTiming(DELETE_PENDING_MIN_OPACITY, {
            duration: DELETE_PENDING_PULSE_DURATION_MS,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(DELETE_PENDING_MAX_OPACITY, {
            duration: DELETE_PENDING_PULSE_DURATION_MS,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      );
    },
  );

  return useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  }, [opacity]);
}

export function useDeletingCollapseStyle(args: {
  stage: DeletingVisualStageInput;
  expandedHeight: number;
  expandedMarginTop?: number;
  onFinish?: () => void;
  onFinishUI?: () => void;
}) {
  const { expandedHeight, expandedMarginTop = 0, onFinish, onFinishUI } = args;
  const stageSV = useSharedValue<DeletingVisualStage>(
    resolveDeletingVisualStage(
      isDeletingVisualStageSV(args.stage) ? args.stage.value : args.stage,
    ),
  );
  const expandedHeightSV = useSharedValue(expandedHeight);
  const expandedMarginTopSV = useSharedValue(expandedMarginTop);
  const height = useSharedValue(expandedHeight);
  const marginTop = useSharedValue(expandedMarginTop);
  const onFinishRef = useRef(onFinish);
  const isStageSV = isDeletingVisualStageSV(args.stage);

  const invokeOnFinish = () => {
    onFinishRef.current?.();
  };

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    expandedHeightSV.value = expandedHeight;
    expandedMarginTopSV.value = expandedMarginTop;
  }, [
    expandedHeight,
    expandedHeightSV,
    expandedMarginTop,
    expandedMarginTopSV,
  ]);

  useEffect(() => {
    if (isStageSV) {
      return;
    }

    stageSV.value = resolveDeletingVisualStage(
      args.stage as DeletingVisualStage | boolean,
    );
  }, [args.stage, isStageSV, stageSV]);

  useAnimatedReaction(
    () => {
      if (!isStageSV) {
        return null;
      }

      return resolveDeletingVisualStage(
        (args.stage as SharedValue<DeletingVisualStage>).value,
      );
    },
    nextStage => {
      if (nextStage === null) {
        return;
      }

      stageSV.value = nextStage;
    },
  );

  useAnimatedReaction(
    () => {
      return {
        expandedHeight: expandedHeightSV.value,
        expandedMarginTop: expandedMarginTopSV.value,
        stage: stageSV.value,
      };
    },
    (next, prev) => {
      if (
        prev &&
        prev.stage === next.stage &&
        prev.expandedHeight === next.expandedHeight &&
        prev.expandedMarginTop === next.expandedMarginTop
      ) {
        return;
      }

      cancelAnimation(height);
      cancelAnimation(marginTop);

      if (next.stage === 'finishing') {
        height.value = withTiming(
          0,
          {
            duration: DELETE_FINISH_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          },
          finished => {
            if (!finished) {
              return;
            }

            onFinishUI?.();

            if (onFinishRef.current) {
              runOnJS(invokeOnFinish)();
            }
          },
        );
        marginTop.value = withTiming(0, {
          duration: DELETE_FINISH_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
        return;
      }

      height.value = withTiming(next.expandedHeight, { duration: 0 });
      marginTop.value = withTiming(next.expandedMarginTop, { duration: 0 });
    },
  );

  return useAnimatedStyle(() => {
    return {
      height: height.value,
      marginTop: marginTop.value,
      overflow: stageSV.value === 'finishing' ? 'hidden' : 'visible',
    };
  }, [height, marginTop, stageSV]);
}
