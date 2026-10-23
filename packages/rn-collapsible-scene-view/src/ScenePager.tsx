import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  getPagerDragPosition,
  resolvePagerBoundary,
  resolvePagerTarget,
} from './pagerMath';

export type ScenePagerTrack = {
  keys: readonly string[];
  position: SharedValue<number>;
  width: SharedValue<number>;
};

export type ScenePagerProps = {
  activeKey: string;
  children: (
    track: ScenePagerTrack,
    previewKey: string | null,
    previewScrollOffset: number,
  ) => React.ReactNode;
  keys: readonly string[];
  onBoundary?: (direction: 'next' | 'prev') => void;
  /** Publish the controlled key synchronously (including optimistic state). */
  onIndexChange: (key: string) => void;
  /** Coordinates in the one native list, not a JS scroll-position mirror. */
  rowRegion: { startOffset: number; scrollOffset: SharedValue<number> };
  testID?: string;
};

/**
 * Headless row track: the caller keeps one native list and wraps only its rows
 * in ScenePagerItem. Header/chrome never inherit a horizontal transform.
 * The bounded neighbour preview remains until the settled data is committed.
 */
export function ScenePager({
  activeKey,
  children,
  keys,
  onBoundary,
  onIndexChange,
  rowRegion,
  testID,
}: ScenePagerProps) {
  const activeIndex = Math.max(0, keys.indexOf(activeKey));
  const position = useSharedValue(activeIndex);
  const width = useSharedValue(0);
  const committedIndex = useSharedValue(activeIndex);
  const startIndex = useSharedValue(activeIndex);
  const settling = useSharedValue(false);
  const ended = useSharedValue(false);
  const gestureActive = useSharedValue(false);
  const lastPreview = useSharedValue(-1);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);
  const [commitAttempt, setCommitAttempt] = useState<number | null>(null);
  const currentKey = useRef(activeKey);
  const mounted = useRef(true);
  const generation = useRef(0);
  const generationValue = useSharedValue(0);
  const startGeneration = useSharedValue(0);
  const measuredWidth = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimation(position);
    };
  }, [position]);

  useLayoutEffect(() => {
    currentKey.current = activeKey;
    generationValue.value = ++generation.current;
    cancelAnimation(position);
    committedIndex.value = activeIndex;
    position.value = activeIndex;
    settling.value = false;
    setPreviewKey(null);
  }, [
    activeKey,
    activeIndex,
    committedIndex,
    generationValue,
    position,
    settling,
  ]);

  useLayoutEffect(() => {
    if (commitAttempt == null) {
      return;
    }
    // If the controlled owner rejected the request (or batched a rollback to
    // the same key), there is no key-change effect to release the gesture.
    if (commitAttempt === generation.current) {
      cancelAnimation(position);
      position.value = activeIndex;
      settling.value = false;
      setPreviewKey(null);
    }
    setCommitAttempt(null);
  }, [activeIndex, commitAttempt, position, settling]);

  const publishPreview = useCallback(
    (key: string | null, fromKey: string, token: number, offset: number) => {
      if (
        mounted.current &&
        currentKey.current === fromKey &&
        generation.current === token
      ) {
        setPreviewKey(key);
        setPreviewScrollOffset(offset);
      }
    },
    [],
  );
  const commit = useCallback(
    (key: string, fromKey: string, token: number) => {
      if (
        mounted.current &&
        currentKey.current === fromKey &&
        generation.current === token
      ) {
        setCommitAttempt(token);
        onIndexChange(key);
      }
    },
    [onIndexChange],
  );
  const reportBoundary = useCallback(
    (direction: 'next' | 'prev', token: number) => {
      if (mounted.current && generation.current === token) {
        onBoundary?.(direction);
      }
    },
    [onBoundary],
  );
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.max(0, event.nativeEvent.layout.width);
      if (measuredWidth.current !== nextWidth) {
        measuredWidth.current = nextWidth;
        generationValue.value = ++generation.current;
        cancelAnimation(position);
        position.value = activeIndex;
        settling.value = false;
        setPreviewKey(null);
        width.value = nextWidth;
      }
    },
    [activeIndex, generationValue, position, settling, width],
  );
  const { startOffset, scrollOffset } = rowRegion;
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('scene-pager-pan')
        .maxPointers(1)
        .onTouchesDown((event, manager) => {
          'worklet';
          const touch = event.allTouches[0];
          if (
            settling.value ||
            event.numberOfTouches !== 1 ||
            !touch ||
            touch.y + Math.max(0, scrollOffset.value) < startOffset
          ) {
            manager.fail();
          }
        })
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          'worklet';
          gestureActive.value = false;
        })
        .onStart(() => {
          'worklet';
          gestureActive.value = true;
          cancelAnimation(position);
          startIndex.value = committedIndex.value;
          startGeneration.value = generationValue.value;
          ended.value = false;
          lastPreview.value = -1;
        })
        .onUpdate(event => {
          'worklet';
          if (startGeneration.value !== generationValue.value) {
            return;
          }
          position.value = getPagerDragPosition({
            startIndex: startIndex.value,
            translationX: event.translationX,
            width: width.value,
            pageCount: keys.length,
          });
          const neighbour =
            startIndex.value + (event.translationX < 0 ? 1 : -1);
          if (neighbour !== lastPreview.value) {
            lastPreview.value = neighbour;
            runOnJS(publishPreview)(
              keys[neighbour] ?? null,
              keys[startIndex.value],
              startGeneration.value,
              scrollOffset.value,
            );
          }
        })
        .onEnd((event, success) => {
          'worklet';
          if (!success || startGeneration.value !== generationValue.value) {
            return;
          }
          ended.value = true;
          settling.value = true;
          const from = startIndex.value;
          const token = startGeneration.value;
          const target = resolvePagerTarget({
            startIndex: from,
            translationX: event.translationX,
            velocityX: event.velocityX,
            width: width.value,
            pageCount: keys.length,
          });
          const boundary = resolvePagerBoundary({
            startIndex: from,
            translationX: event.translationX,
            pageCount: keys.length,
          });
          if (target !== from) {
            runOnJS(publishPreview)(
              keys[target],
              keys[from],
              token,
              scrollOffset.value,
            );
          }
          position.value = withTiming(target, { duration: 180 }, finished => {
            if (!finished) {
              return;
            }
            if (target !== from) {
              runOnJS(commit)(keys[target], keys[from], token);
            } else {
              settling.value = false;
              runOnJS(publishPreview)(null, keys[from], token, 0);
              if (boundary) {
                runOnJS(reportBoundary)(boundary, token);
              }
            }
          });
        })
        .onFinalize(() => {
          'worklet';
          if (gestureActive.value && !ended.value) {
            const from = committedIndex.value;
            const token = generationValue.value;
            position.value = withTiming(from, { duration: 180 }, finished => {
              if (finished) {
                runOnJS(publishPreview)(null, keys[from], token, 0);
              }
            });
          }
          gestureActive.value = false;
        }),
    [
      commit,
      committedIndex,
      ended,
      generationValue,
      gestureActive,
      keys,
      lastPreview,
      position,
      publishPreview,
      reportBoundary,
      scrollOffset,
      settling,
      startIndex,
      startOffset,
      startGeneration,
      width,
    ],
  );
  const track = useMemo(
    () => ({ keys, position, width }),
    [keys, position, width],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View onLayout={onLayout} style={styles.viewport} testID={testID}>
        {children(track, previewKey, previewScrollOffset)}
      </View>
    </GestureDetector>
  );
}

/** Also used for each active list row, so the list header stays stationary. */
export function ScenePagerItem({
  children,
  pageKey,
  style: containerStyle,
  track,
}: {
  children: React.ReactNode;
  pageKey: string;
  style?: StyleProp<ViewStyle>;
  track: ScenePagerTrack;
}) {
  const index = track.keys.indexOf(pageKey);
  const { position, width } = track;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (index - position.value) * width.value }],
  }));
  return (
    <Animated.View style={[containerStyle, style]}>{children}</Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
});
