import {
  ANIMATION_STATUS,
  KEYBOARD_STATUS,
  SCROLLABLE_STATUS,
  useBottomSheetInternal,
  useScrollEventsHandlersDefault,
  type ScrollEventHandlerCallbackType,
  type ScrollEventsHandlersHookType,
} from '@gorhom/bottom-sheet';
import { createContext, useCallback, useContext, useLayoutEffect } from 'react';
import type { View } from 'react-native';
import { State } from 'react-native-gesture-handler';
import {
  measure,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';

type Options = {
  contentRef: AnimatedRef<View>;
  enabled: boolean;
  pageKey: string;
  targetHeight: number;
  touchRevision: SharedValue<number>;
};

export const PositionTpSlAndroidScrollContext = createContext<Options | null>(
  null,
);

type Restoration = {
  id: number;
  pageKey: string;
  touchRevision: number;
  inputTarget: number;
  startPosition: number;
  startHeight: number;
  startOffset: number;
  contentHeight: number;
  progress: number;
  offset: number;
  targetHeight: number;
  targetPosition: number;
};

const TOLERANCE = 1;
const progressBetween = (start: number, end: number, current: number) => {
  'worklet';
  return Math.abs(end - start) <= TOLERANCE
    ? 1
    : Math.max(0, Math.min(1, (current - start) / (end - start)));
};

/** Only installed on this sheet's Android scrollable; all other gestures delegate. */
export const usePositionTpSlAndroidScrollRestoration: ScrollEventsHandlersHookType =
  (scrollableRef, contentOffsetY) => {
    const options = useContext(PositionTpSlAndroidScrollContext)!;
    const { contentRef, enabled, pageKey, targetHeight, touchRevision } =
      options;
    const defaults = useScrollEventsHandlersDefault(
      scrollableRef,
      contentOffsetY,
    );
    const {
      handleOnScroll: defaultOnScroll,
      handleOnBeginDrag: defaultOnBeginDrag,
      handleOnEndDrag: defaultOnEndDrag,
      handleOnMomentumEnd: defaultOnMomentumEnd,
    } = defaults;
    const {
      animatedAnimationState,
      animatedContentGestureState,
      animatedHandleGestureState,
      animatedKeyboardState,
      animatedLayoutState,
      animatedDetentsState,
      animatedPosition,
      animatedScrollableState,
      animatedScrollableStatus,
    } = useBottomSheetInternal();
    // Gorhom's hook type exposes RefObject; useScrollHandler supplies AnimatedRef.
    const nativeScrollRef = scrollableRef as AnimatedRef<
      NonNullable<typeof scrollableRef.current>
    >;
    const configuration = useSharedValue({ enabled, pageKey, targetHeight });
    const armed = useSharedValue<{
      target: number;
      touchRevision: number;
    } | null>(null);
    const sequence = useSharedValue(0);
    const restoration = useSharedValue<Restoration | null>(null);

    useLayoutEffect(() => {
      runOnUI(() => {
        configuration.value = { enabled, pageKey, targetHeight };
        armed.value = null;
        restoration.value = null;
      })();
      return () => {
        runOnUI(() => {
          configuration.value = { enabled: false, pageKey, targetHeight };
          armed.value = null;
          restoration.value = null;
        })();
      };
    }, [armed, configuration, enabled, pageKey, restoration, targetHeight]);

    const isRestoring = useCallback(() => {
      'worklet';
      const current = restoration.value;
      const config = configuration.value;
      return (
        current !== null &&
        config.enabled &&
        current.pageKey === config.pageKey &&
        current.targetHeight === config.targetHeight &&
        current.touchRevision === touchRevision.value &&
        animatedKeyboardState.value.status === KEYBOARD_STATUS.HIDDEN &&
        (animatedKeyboardState.value.target == null ||
          animatedKeyboardState.value.target === current.inputTarget) &&
        animatedContentGestureState.value !== State.ACTIVE &&
        animatedContentGestureState.value !== State.BEGAN &&
        animatedHandleGestureState.value !== State.ACTIVE &&
        animatedHandleGestureState.value !== State.BEGAN &&
        !animatedAnimationState.value.isForcedClosing &&
        animatedAnimationState.value.nextIndex !== -1 &&
        animatedPosition.value <= current.targetPosition + TOLERANCE
      );
    }, [
      animatedAnimationState,
      animatedContentGestureState,
      animatedHandleGestureState,
      animatedKeyboardState,
      animatedPosition,
      configuration,
      restoration,
      touchRevision,
    ]);

    const advance = useCallback(
      function advanceRestoration(id: number) {
        'worklet';
        if (restoration.value?.id !== id) {
          return;
        }
        if (!isRestoring()) {
          restoration.value = null;
          return;
        }
        const viewport = measure(nativeScrollRef);
        const content = measure(contentRef);
        if (
          !viewport ||
          !content ||
          viewport.height <= 0 ||
          content.height <= 0
        ) {
          restoration.value = null;
          return;
        }
        const current = restoration.value!;
        const finalHeight =
          current.targetHeight - animatedLayoutState.value.handleHeight;
        const positionProgress = progressBetween(
          current.startPosition,
          current.targetPosition,
          animatedPosition.value,
        );
        // The content mask animates independently of the sheet position.
        const viewportProgress = progressBetween(
          current.startHeight,
          finalHeight,
          viewport.height,
        );
        const progress = Math.min(positionProgress, viewportProgress);
        const actualOffset = Math.max(0, viewport.pageY - content.pageY);
        const contentChanged =
          Math.abs(content.height - current.contentHeight) > TOLERANCE;
        // A layout delivered during restoration gets the remaining native motion,
        // rather than retroactively applying an already completed fraction.
        const startOffset = contentChanged ? actualOffset : current.startOffset;
        const startProgress = contentChanged ? progress : current.progress;
        const remainingProgress =
          startProgress >= 1
            ? 1
            : Math.max(0, (progress - startProgress) / (1 - startProgress));
        const targetOffset = Math.max(0, content.height - finalHeight);
        const offset = Math.min(
          Math.max(0, content.height - viewport.height),
          Math.max(
            0,
            startOffset + (targetOffset - startOffset) * remainingProgress,
          ),
        );
        restoration.value = {
          ...current,
          startOffset,
          progress: startProgress,
          contentHeight: content.height,
          offset,
        };
        if (Math.abs(actualOffset - offset) > TOLERANCE) {
          scrollTo(nativeScrollRef, 0, offset, false);
        }
        contentOffsetY.value = offset;
        const finished =
          animatedAnimationState.value.status === ANIMATION_STATUS.STOPPED &&
          animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED &&
          Math.abs(animatedPosition.value - current.targetPosition) <=
            TOLERANCE &&
          Math.abs(viewport.height - finalHeight) <= TOLERANCE;
        if (finished) {
          // Hand the final scroll offset back through the same contract as the
          // default end-drag handler. Keyboard/gesture/lock state is never written.
          animatedScrollableState.value = {
            ...animatedScrollableState.value,
            contentOffsetY: offset,
          };
          restoration.value = null;
          return;
        }
        // UI-thread frames exist only for this restoration, never an idle poll or
        // a JS timer. The id prevents an old frame from joining a new session.
        requestAnimationFrame(() => advanceRestoration(id));
      },
      [
        animatedAnimationState,
        animatedLayoutState,
        animatedPosition,
        animatedScrollableState,
        animatedScrollableStatus,
        contentOffsetY,
        contentRef,
        isRestoring,
        nativeScrollRef,
        restoration,
      ],
    );

    const startRestoration = useCallback(() => {
      'worklet';
      if (
        armed.value === null ||
        animatedKeyboardState.value.status !== KEYBOARD_STATUS.HIDDEN
      ) {
        return;
      }
      const keyboardSession = armed.value;
      armed.value = null;
      if (
        keyboardSession.touchRevision !== touchRevision.value ||
        (animatedKeyboardState.value.target != null &&
          animatedKeyboardState.value.target !== keyboardSession.target)
      ) {
        return;
      }
      const config = configuration.value;
      const targetPosition = animatedDetentsState.value.detents?.[0];
      const handleHeight = animatedLayoutState.value.handleHeight;
      const viewport = measure(nativeScrollRef);
      const content = measure(contentRef);
      if (
        !config.enabled ||
        targetPosition == null ||
        handleHeight < 0 ||
        config.targetHeight <= handleHeight ||
        !viewport ||
        !content ||
        viewport.width <= 0 ||
        content.width <= 0
      ) {
        return;
      }
      sequence.value++;
      restoration.value = {
        id: sequence.value,
        pageKey: config.pageKey,
        touchRevision: touchRevision.value,
        inputTarget: keyboardSession.target,
        startPosition: animatedPosition.value,
        startHeight: viewport.height,
        startOffset: Math.max(0, viewport.pageY - content.pageY),
        contentHeight: content.height,
        progress: 0,
        offset: Math.max(0, viewport.pageY - content.pageY),
        targetHeight: config.targetHeight,
        targetPosition,
      };
      advance(sequence.value);
    }, [
      advance,
      animatedDetentsState,
      animatedKeyboardState,
      animatedLayoutState,
      animatedPosition,
      armed,
      configuration,
      contentRef,
      nativeScrollRef,
      restoration,
      sequence,
      touchRevision,
    ]);

    useAnimatedReaction(
      () => ({
        ...configuration.value,
        status: animatedKeyboardState.value.status,
        target: animatedKeyboardState.value.target,
        touchRevision: touchRevision.value,
      }),
      (current, previous) => {
        if (
          !previous ||
          !current.enabled ||
          current.pageKey !== previous.pageKey
        ) {
          return;
        }
        if (
          current.status !== KEYBOARD_STATUS.SHOWN &&
          current.touchRevision !== previous.touchRevision
        ) {
          armed.value = null;
          restoration.value = null;
          return;
        }
        if (current.status === KEYBOARD_STATUS.SHOWN) {
          restoration.value = null;
          if (
            current.target != null &&
            (previous.status !== KEYBOARD_STATUS.SHOWN ||
              current.target !== previous.target)
          ) {
            armed.value = {
              target: current.target,
              touchRevision: current.touchRevision,
            };
          } else if (armed.value) {
            armed.value = {
              ...armed.value,
              touchRevision: current.touchRevision,
            };
          }
        } else {
          startRestoration();
        }
      },
      [startRestoration],
    );

    const delegate = useCallback(
      (
        handler: ScrollEventHandlerCallbackType | undefined,
        event: Parameters<ScrollEventHandlerCallbackType>[0],
        context: never,
      ) => {
        'worklet';
        // Native layout may dispatch scroll before the keyboard reaction runs.
        startRestoration();
        if (isRestoring()) {
          const offset = Math.min(
            restoration.value!.offset,
            Math.max(
              0,
              event.contentSize.height - event.layoutMeasurement.height,
            ),
          );
          handler?.(event, {
            ...(context as object),
            shouldLockInitialPosition: true,
            initialContentOffsetY: offset,
          } as never);
          // The default locked momentum-end handler writes 0 even when it used
          // an initial lock position. Keep this scrollable's offset consistent.
          contentOffsetY.value = offset;
          return;
        }
        handler?.(event, context);
      },
      [contentOffsetY, isRestoring, restoration, startRestoration],
    );
    const handleOnScroll: ScrollEventHandlerCallbackType = useCallback(
      (event, context) => {
        'worklet';
        delegate(defaultOnScroll, event, context);
      },
      [defaultOnScroll, delegate],
    );
    const handleOnEndDrag: ScrollEventHandlerCallbackType = useCallback(
      (event, context) => {
        'worklet';
        delegate(defaultOnEndDrag, event, context);
      },
      [defaultOnEndDrag, delegate],
    );
    const handleOnMomentumEnd: ScrollEventHandlerCallbackType = useCallback(
      (event, context) => {
        'worklet';
        delegate(defaultOnMomentumEnd, event, context);
      },
      [defaultOnMomentumEnd, delegate],
    );
    const handleOnBeginDrag: NonNullable<
      ReturnType<ScrollEventsHandlersHookType>['handleOnBeginDrag']
    > = useCallback(
      (event, context) => {
        'worklet';
        if (animatedKeyboardState.value.status !== KEYBOARD_STATUS.SHOWN) {
          armed.value = null;
        }
        restoration.value = null;
        defaultOnBeginDrag?.(event, context);
      },
      [animatedKeyboardState, armed, defaultOnBeginDrag, restoration],
    );

    return {
      ...defaults,
      handleOnScroll,
      handleOnBeginDrag,
      handleOnEndDrag,
      handleOnMomentumEnd,
    };
  };
