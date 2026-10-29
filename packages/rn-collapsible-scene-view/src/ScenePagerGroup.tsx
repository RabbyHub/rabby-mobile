import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  runOnUI,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { ScenePagerTrack } from './ScenePager';
import { getPagerDragPosition } from './pagerMath';
import {
  resolveLinkedPagerOwner,
  isLinkedPagerRowInViewport,
  type LinkedPagerRowBounds,
  type LinkedPagerViewport,
  type LinkedPagerTrack,
} from './linkedPagerMath';

type GroupMotion = {
  tracks: readonly LinkedPagerTrack[];
  settledIndices: SharedValue<Record<string, number>>;
  owner: SharedValue<string | null>;
  position: SharedValue<number>;
  width: SharedValue<number>;
  gestureViewport: SharedValue<LinkedPagerViewport>;
};
type GroupPreview = {
  trackKey: string;
  pageKey: string;
  scrollOffset: number;
} | null;
const MotionContext = createContext<GroupMotion | null>(null);
const PreviewContext = createContext<GroupPreview>(null);

/** One horizontal recognizer for a hierarchy; vertical motion stays native.
 * A child at its settled edge hands the same drag to its first movable parent.
 * Only the selected track moves; this never synthesizes vertical scrollTo.
 */
export function ScenePagerGroup({
  children,
  tracks,
  scrollOffset,
  onIndexChange,
  testID,
}: React.PropsWithChildren<{
  tracks: readonly LinkedPagerTrack[];
  scrollOffset: SharedValue<number>;
  onIndexChange: (trackKey: string, pageKey: string) => void;
  testID?: string;
}>) {
  const owner = useSharedValue<string | null>(null);
  const position = useSharedValue(0);
  const width = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const gestureViewport = useSharedValue<LinkedPagerViewport>({
    offset: 0,
    height: 0,
  });
  const settledIndices = useSharedValue<Record<string, number>>(
    Object.fromEntries(
      tracks.map(track => [track.key, track.keys.indexOf(track.activeKey)]),
    ),
  );
  const settling = useSharedValue(false);
  const gestureActive = useSharedValue(false);
  const ended = useSharedValue(false);
  const contentY = useSharedValue(0);
  const startOffset = useSharedValue(0);
  const generationValue = useSharedValue(0);
  const startGeneration = useSharedValue(0);
  const lastPreview = useSharedValue('');
  const generation = useRef(0);
  const mounted = useRef(true);
  const measuredWidth = useRef(0);
  const measuredHeight = useRef(0);
  const [preview, setPreview] = useState<GroupPreview>(null);
  const [commitAttempt, setCommitAttempt] = useState<number | null>(null);
  // Feed/children renders must not invalidate an in-flight gesture. Only the
  // controlled hierarchy, its selection or hit-region geometry does that.
  const configuration = JSON.stringify(tracks);
  useLayoutEffect(() => {
    const nextIndices = Object.fromEntries(
      (JSON.parse(configuration) as LinkedPagerTrack[]).map(track => [
        track.key,
        track.keys.indexOf(track.activeKey),
      ]),
    );
    // Existing derived mappers must observe the new settled positions and the
    // end of motion together, before replacement mappers have been installed.
    runOnUI((token: number, indices: Record<string, number>) => {
      'worklet';
      generationValue.value = token;
      cancelAnimation(position);
      settledIndices.value = indices;
      owner.value = null;
      settling.value = false;
    })(++generation.current, nextIndices);
    setPreview(null);
  }, [
    configuration,
    generationValue,
    owner,
    position,
    settledIndices,
    settling,
  ]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimation(position);
    };
  }, [position]);
  useLayoutEffect(() => {
    if (commitAttempt == null) {
      return;
    }
    // A controlled rejection or batched rollback has no selection effect.
    if (generation.current === commitAttempt) {
      cancelAnimation(position);
      owner.value = null;
      settling.value = false;
      setPreview(null);
    }
    setCommitAttempt(null);
  }, [commitAttempt, owner, position, settling]);

  const publishPreview = useCallback((next: GroupPreview, token: number) => {
    if (mounted.current && token === generation.current) {
      setPreview(previous =>
        previous?.trackKey === next?.trackKey &&
        previous?.pageKey === next?.pageKey &&
        previous?.scrollOffset === next?.scrollOffset
          ? previous
          : next,
      );
    }
  }, []);
  const commit = useCallback(
    (trackKey: string, pageKey: string, token: number) => {
      if (mounted.current && token === generation.current) {
        setCommitAttempt(token);
        onIndexChange(trackKey, pageKey);
      }
    },
    [onIndexChange],
  );
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.max(0, event.nativeEvent.layout.width);
      const nextHeight = Math.max(0, event.nativeEvent.layout.height);
      if (
        nextWidth !== measuredWidth.current ||
        nextHeight !== measuredHeight.current
      ) {
        measuredWidth.current = nextWidth;
        measuredHeight.current = nextHeight;
        generationValue.value = ++generation.current;
        cancelAnimation(position);
        owner.value = null;
        settling.value = false;
        setPreview(null);
        width.value = nextWidth;
        viewportHeight.value = nextHeight;
      }
    },
    [generationValue, owner, position, settling, width, viewportHeight],
  );
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('scene-pager-group-pan')
        .maxPointers(1)
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onTouchesDown((event, manager) => {
          'worklet';
          const touch = event.allTouches[0];
          if (settling.value || event.numberOfTouches !== 1 || !touch) {
            manager.fail();
            return;
          }
          startOffset.value = Math.max(0, scrollOffset.value);
          gestureViewport.value = {
            offset: startOffset.value,
            height: viewportHeight.value,
          };
          contentY.value = touch.y + startOffset.value;
        })
        .onBegin(() => {
          'worklet';
          gestureActive.value = false;
        })
        .onStart(() => {
          'worklet';
          cancelAnimation(position);
          gestureActive.value = true;
          ended.value = false;
          startGeneration.value = generationValue.value;
          lastPreview.value = '';
        })
        .onUpdate(event => {
          'worklet';
          if (startGeneration.value !== generationValue.value) {
            return;
          }
          const selection = resolveLinkedPagerOwner({
            tracks,
            contentY: contentY.value,
            translationX: event.translationX,
            width: width.value,
          });
          const track = tracks.find(item => item.key === selection?.ownerKey);
          if (!selection || !track) {
            owner.value = null;
            if (lastPreview.value !== '') {
              lastPreview.value = '';
              runOnJS(publishPreview)(null, startGeneration.value);
            }
            return;
          }
          owner.value = track.key;
          position.value = getPagerDragPosition({
            startIndex: selection.ownerIndex,
            translationX: event.translationX,
            width: width.value,
            pageCount: track.keys.length,
          });
          const neighbour =
            selection.ownerIndex + (event.translationX < 0 ? 1 : -1);
          const pageKey = track.keys[neighbour];
          const previewId = pageKey ? `${track.key}:${pageKey}` : '';
          if (lastPreview.value !== previewId) {
            lastPreview.value = previewId;
            runOnJS(publishPreview)(
              pageKey
                ? {
                    trackKey: track.key,
                    pageKey,
                    scrollOffset: startOffset.value,
                  }
                : null,
              startGeneration.value,
            );
          }
        })
        .onEnd((event, success) => {
          'worklet';
          if (!success || startGeneration.value !== generationValue.value) {
            return;
          }
          const selection = resolveLinkedPagerOwner({
            tracks,
            contentY: contentY.value,
            translationX: event.translationX,
            velocityX: event.velocityX,
            width: width.value,
          });
          const track = tracks.find(item => item.key === selection?.ownerKey);
          ended.value = true;
          if (!selection || !track) {
            owner.value = null;
            runOnJS(publishPreview)(null, startGeneration.value);
            return;
          }
          const token = startGeneration.value;
          const { ownerIndex, targetIndex } = selection;
          // A final reverse fling can choose a different level. Start that
          // level at its committed position, not the previous child's progress.
          if (owner.value !== track.key) {
            position.value = ownerIndex;
          }
          owner.value = track.key;
          settling.value = true;
          if (targetIndex !== ownerIndex) {
            runOnJS(publishPreview)(
              {
                trackKey: track.key,
                pageKey: track.keys[targetIndex],
                scrollOffset: startOffset.value,
              },
              token,
            );
          }
          position.value = withTiming(
            targetIndex,
            { duration: 180 },
            finished => {
              if (!finished || token !== generationValue.value) {
                return;
              }
              if (targetIndex !== ownerIndex) {
                runOnJS(commit)(track.key, track.keys[targetIndex], token);
              } else {
                owner.value = null;
                settling.value = false;
                runOnJS(publishPreview)(null, token);
              }
            },
          );
        })
        .onFinalize(() => {
          'worklet';
          if (
            gestureActive.value &&
            !ended.value &&
            startGeneration.value === generationValue.value
          ) {
            const track = tracks.find(item => item.key === owner.value);
            const token = startGeneration.value;
            settling.value = true;
            position.value = withTiming(
              track ? track.keys.indexOf(track.activeKey) : 0,
              { duration: 180 },
              finished => {
                if (finished && token === generationValue.value) {
                  owner.value = null;
                  settling.value = false;
                  runOnJS(publishPreview)(null, token);
                }
              },
            );
          }
          gestureActive.value = false;
        }),
    [
      commit,
      contentY,
      ended,
      generationValue,
      gestureActive,
      gestureViewport,
      lastPreview,
      owner,
      position,
      publishPreview,
      scrollOffset,
      settling,
      startGeneration,
      startOffset,
      tracks,
      width,
      viewportHeight,
    ],
  );
  const motion = useMemo(
    () => ({ tracks, owner, position, settledIndices, width, gestureViewport }),
    [tracks, owner, position, settledIndices, width, gestureViewport],
  );
  return (
    <MotionContext.Provider value={motion}>
      <PreviewContext.Provider value={preview}>
        <GestureDetector gesture={gesture}>
          <View onLayout={onLayout} style={styles.viewport} testID={testID}>
            {children}
          </View>
        </GestureDetector>
      </PreviewContext.Provider>
    </MotionContext.Provider>
  );
}

/** Preview publication is separate so it cannot invalidate mounted row tracks. */
export const useScenePagerGroupPreview = () => useContext(PreviewContext);

export function useScenePagerGroupTrack(key: string): ScenePagerTrack {
  const group = useContext(MotionContext);
  if (!group) {
    throw new Error('Scene pager track requires ScenePagerGroup');
  }
  const descriptor = group.tracks.find(track => track.key === key);
  if (!descriptor) {
    throw new Error('Unknown scene pager track');
  }
  const { owner, position, settledIndices, width } = group;
  const trackPosition = useDerivedValue(() =>
    owner.value === key ? position.value : settledIndices.value[key] ?? 0,
  );
  return useMemo(
    () => ({ keys: descriptor.keys, position: trackPosition, width }),
    [descriptor.keys, trackPosition, width],
  );
}

/** A single host for a row shared by several exclusive horizontal tracks.
 * Supply bounds only when exact and stable for the gesture (not estimated
 * heights or row-local onLayout.y). Unknown bounds retain full participation.
 * The viewport is captured on touch-down, so native vertical scrolling never
 * publishes a per-row animation update. A numeric derived value also suppresses
 * repeated native props updates for offscreen rows whose translation stays 0.
 */
export function ScenePagerGroupRow({
  children,
  pages,
  contentBounds,
  overscan = 0,
}: React.PropsWithChildren<{
  pages: Readonly<Record<string, string>>;
  contentBounds?: LinkedPagerRowBounds;
  overscan?: number;
}>) {
  const group = useContext(MotionContext);
  if (!group) {
    throw new Error('Scene pager row requires ScenePagerGroup');
  }
  const { tracks, owner, position, width, gestureViewport } = group;
  const translation = useDerivedValue(() => {
    const key = owner.value;
    if (
      !key ||
      !isLinkedPagerRowInViewport(
        contentBounds,
        gestureViewport.value,
        overscan,
      )
    ) {
      return 0;
    }
    const track = tracks.find(item => item.key === key);
    const index = track?.keys.indexOf(pages[key]);
    return track && index !== undefined && index >= 0
      ? (index - position.value) * width.value
      : 0;
  });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ viewport: { flex: 1, overflow: 'hidden' } });
