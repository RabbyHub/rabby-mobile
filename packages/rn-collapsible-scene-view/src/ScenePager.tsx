import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type ScenePagerProps = {
  activeKey: string;
  keys: readonly string[];
  onBoundary?: (direction: 'next' | 'prev') => void;
  onIndexChange: (key: string) => void;
  onPreview?: (key: string | null) => void;
  renderPage: (key: string, active: boolean) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SETTLE_MS = 180;

/**
 * A caller-controlled horizontal track. It is not a native pager: it only
 * translates the page track on the UI thread and reports an index change when
 * the gesture settles. Nesting and cross-level boundary handoff are owned by a
 * caller-level gesture arbiter.
 */
export const ScenePager = ({
  activeKey,
  keys,
  onBoundary,
  onIndexChange,
  onPreview,
  renderPage,
  style,
  testID,
}: ScenePagerProps) => {
  const activeIndex = Math.max(keys.indexOf(activeKey), 0);
  const [width, setWidth] = useState(0);
  const widthValue = useSharedValue(0);
  const trackX = useSharedValue(0);
  const startX = useSharedValue(0);
  const dragging = useSharedValue(false);
  const reportedIndex = useSharedValue(activeIndex);
  const lastPreview = useSharedValue(-1);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    widthValue.value = width;
    if (!dragging.value) {
      trackX.value = -activeIndex * width;
      reportedIndex.value = activeIndex;
    }
  }, [activeIndex, trackX, width, widthValue, dragging, reportedIndex]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0) {
      setWidth(next);
    }
  }, []);

  const changeIndex = useCallback(
    (index: number) => {
      if (!mounted.current) {
        return;
      }
      const key = keys[index];
      if (key) {
        onIndexChange(key);
      }
    },
    [keys, onIndexChange],
  );

  const publishPreview = useCallback(
    (index: number | null) => {
      if (!mounted.current) {
        return;
      }
      onPreview?.(index == null ? null : keys[index] ?? null);
    },
    [keys, onPreview],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          'worklet';
          dragging.value = true;
          startX.value = trackX.value;
          lastPreview.value = -1;
        })
        .onUpdate(event => {
          'worklet';
          if (!dragging.value || widthValue.value <= 0) {
            return;
          }
          const min = -(keys.length - 1) * widthValue.value;
          const next = Math.min(
            0,
            Math.max(min, startX.value + event.translationX),
          );
          trackX.value = next;
          const position = -next / widthValue.value;
          const nearest = Math.max(
            0,
            Math.min(keys.length - 1, Math.round(position)),
          );
          if (nearest !== lastPreview.value) {
            lastPreview.value = nearest;
            runOnJS(publishPreview)(nearest);
          }
        })
        .onEnd(event => {
          'worklet';
          if (!dragging.value || widthValue.value <= 0) {
            dragging.value = false;
            return;
          }
          dragging.value = false;
          const position = -trackX.value / widthValue.value;
          const velocityBias = event.velocityX / widthValue.value / 6;
          const target = Math.max(
            0,
            Math.min(keys.length - 1, Math.round(position + velocityBias)),
          );
          const atStart = target <= 0 && position < -0.05;
          const atEnd =
            target >= keys.length - 1 && position > keys.length - 0.95;
          if (atStart || atEnd) {
            runOnJS(onBoundary ?? (() => undefined))(atStart ? 'prev' : 'next');
          }
          trackX.value = withTiming(-target * widthValue.value, {
            duration: SETTLE_MS,
          });
          if (target !== reportedIndex.value) {
            reportedIndex.value = target;
            runOnJS(changeIndex)(target);
          }
          runOnJS(publishPreview)(null);
        })
        .onFinalize(() => {
          'worklet';
          dragging.value = false;
        }),
    [
      changeIndex,
      dragging,
      keys.length,
      lastPreview,
      onBoundary,
      publishPreview,
      reportedIndex,
      startX,
      trackX,
      widthValue,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: trackX.value }],
  }));

  return (
    <View
      onLayout={handleLayout}
      style={[{ flex: 1, overflow: 'hidden' }, style]}
      testID={testID}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            { flexDirection: 'row', height: '100%' },
            width > 0 ? { width: width * keys.length } : null,
            animatedStyle,
          ]}>
          {keys.map(key => (
            <View
              key={key}
              style={{ height: '100%', width: width || undefined }}>
              {renderPage(key, key === activeKey)}
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
