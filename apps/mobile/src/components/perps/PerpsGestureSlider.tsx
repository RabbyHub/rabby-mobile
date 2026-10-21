import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

type Props = {
  allowTouchTrack?: boolean;
  disabled?: boolean;
  maximumValue?: number;
  minimumValue?: number;
  maximumTrackTintColor?: string;
  minimumTrackTintColor?: string;
  onSlidingStart?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  onValueChange?: (value: number) => void;
  step?: number;
  style?: StyleProp<ViewStyle>;
  thumbStyle?: StyleProp<ViewStyle>;
  thumbProps?: { children?: React.ReactNode };
  trackStyle?: StyleProp<ViewStyle>;
  value: number;
};

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.max(min, Math.min(max, value));
};

// Match the existing RNEUI rail and minimum-relative step calculation.
export const perpsSliderValueAt = (
  left: number,
  travel: number,
  min: number,
  max: number,
  step: number,
) => {
  'worklet';
  const offset = (left / travel) * (max - min);
  return clamp(
    (step > 0 ? Math.round(offset / step) * step : offset) + min,
    min,
    max,
  );
};

/** Perps sheet input: native ownership, with the existing horizontal slider geometry. */
export const PerpsGestureSlider = ({
  allowTouchTrack = false,
  disabled = false,
  maximumValue = 100,
  minimumValue = 0,
  maximumTrackTintColor,
  minimumTrackTintColor,
  onSlidingStart,
  onSlidingComplete,
  onValueChange,
  step = 0,
  style,
  thumbStyle,
  thumbProps,
  trackStyle,
  value,
}: Props) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const thumbWidth = Number(StyleSheet.flatten(thumbStyle)?.width ?? 40);
  const travel = size.width - thumbWidth;
  const validRange =
    Number.isFinite(minimumValue) &&
    Number.isFinite(maximumValue) &&
    maximumValue > minimumValue;
  const enabled =
    !disabled && validRange && travel > 0 && Number.isFinite(value);
  const boundedValue =
    validRange && Number.isFinite(value)
      ? clamp(value, minimumValue, maximumValue)
      : minimumValue;
  const horizontalOverflow = Math.max(0, 40 - thumbWidth) / 2;
  const verticalOverflow = Math.max(0, 40 - size.height) / 2;
  const position = useSharedValue(boundedValue);
  const active = useSharedValue(false);
  const pointer = useSharedValue(-1);
  const session = useSharedValue(0);
  const startX = useSharedValue(0);
  const startLeft = useSharedValue(0);
  const configuration = useMemo(
    () => ({
      enabled,
      minimumValue,
      maximumValue,
      step,
      travel,
      thumbWidth,
      allowTouchTrack,
    }),
    [
      enabled,
      minimumValue,
      maximumValue,
      step,
      travel,
      thumbWidth,
      allowTouchTrack,
    ],
  );
  const current = useRef<
    Pick<Props, 'onSlidingStart' | 'onSlidingComplete' | 'onValueChange'> & {
      configuration: object | null;
    }
  >({
    configuration,
    onSlidingStart,
    onSlidingComplete,
    onValueChange,
  });
  const jsSession = useRef<{ id: number; value: number } | null>(null);

  useLayoutEffect(() => {
    current.current = {
      configuration,
      onSlidingStart,
      onSlidingComplete,
      onValueChange,
    };
  });
  useLayoutEffect(() => {
    // Range/layout changes and unmount must release the sheet owner's drag latch,
    // including when native cancellation/finalize is delivered after removal.
    const owner = configuration;
    active.value = false;
    pointer.value = -1;
    return () => {
      const previous = jsSession.current;
      jsSession.current = null;
      if (previous) {
        current.current.onSlidingComplete?.(previous.value);
      }
      // Invalidate already queued runOnJS deliveries from this configuration.
      if (current.current.configuration === owner) {
        current.current = { ...current.current, configuration: null };
      }
    };
  }, [configuration, active, pointer]);
  useLayoutEffect(() => {
    // A controlled echo must not rewind a gesture that has advanced on the UI thread.
    runOnUI((next: number) => {
      'worklet';
      if (!active.value) {
        position.value = next;
      }
    })(boundedValue);
  }, [boundedValue, configuration, active, position]);

  const begin = useCallback(
    (id: number, initial: number, next: number) => {
      if (current.current.configuration !== configuration) {
        return;
      }
      jsSession.current = { id, value: next };
      current.current.onSlidingStart?.(initial);
      current.current.onValueChange?.(next);
    },
    [configuration],
  );
  const change = useCallback(
    (id: number, next: number) => {
      if (
        current.current.configuration !== configuration ||
        jsSession.current?.id !== id
      ) {
        return;
      }
      jsSession.current.value = next;
      current.current.onValueChange?.(next);
    },
    [configuration],
  );
  const finish = useCallback(
    (id: number) => {
      if (
        current.current.configuration !== configuration ||
        jsSession.current?.id !== id
      ) {
        return;
      }
      const last = jsSession.current.value;
      jsSession.current = null;
      current.current.onSlidingComplete?.(last);
    },
    [configuration],
  );

  const gesture = useMemo(
    () =>
      Gesture.Manual()
        .enabled(enabled)
        .shouldCancelWhenOutside(false)
        // Claim DOWN on the UI thread, before either the sheet Pan or its native
        // ScrollView can activate. No simultaneous relationship: the slider owns
        // this touch through UP/cancellation on both Paper and Fabric.
        .onTouchesDown((event, manager) => {
          'worklet';
          if (pointer.value !== -1) {
            return;
          }
          const touch = event.changedTouches[0];
          if (!enabled || !touch) {
            manager.fail();
            return;
          }
          const left =
            ((position.value - minimumValue) / (maximumValue - minimumValue)) *
            travel;
          const x = touch.x - horizontalOverflow;
          if (!allowTouchTrack && Math.abs(x - left - thumbWidth / 2) > 20) {
            manager.fail();
            return;
          }
          pointer.value = touch.id;
          startX.value = touch.absoluteX;
          startLeft.value = allowTouchTrack ? x - thumbWidth / 2 : left;
          manager.begin();
          manager.activate();
        })
        .onStart(() => {
          'worklet';
          const initial = position.value;
          active.value = true;
          session.value += 1;
          position.value = perpsSliderValueAt(
            startLeft.value,
            travel,
            minimumValue,
            maximumValue,
            step,
          );
          startLeft.value =
            ((position.value - minimumValue) / (maximumValue - minimumValue)) *
            travel;
          runOnJS(begin)(session.value, initial, position.value);
        })
        .onTouchesMove((event, manager) => {
          'worklet';
          if (pointer.value === -1) {
            // A configuration change can invalidate an already active recognizer.
            manager.end();
            return;
          }
          if (!active.value) {
            return;
          }
          const touch = event.allTouches.find(
            item => item.id === pointer.value,
          );
          if (!touch) {
            return;
          }
          const next = perpsSliderValueAt(
            startLeft.value + touch.absoluteX - startX.value,
            travel,
            minimumValue,
            maximumValue,
            step,
          );
          if (next === position.value) {
            return;
          }
          position.value = next;
          runOnJS(change)(session.value, next);
        })
        .onTouchesUp((event, manager) => {
          'worklet';
          if (
            pointer.value === -1 ||
            event.changedTouches.some(touch => touch.id === pointer.value)
          ) {
            pointer.value = -1;
            manager.end();
          }
        })
        .onTouchesCancelled((_event, manager) => {
          'worklet';
          // RNGH may cancel tracked pointers again inside manager.end(). Also,
          // UIKit must end an active recognizer rather than transition to FAILED.
          if (pointer.value === -1) {
            return;
          }
          pointer.value = -1;
          manager.end();
        })
        .onFinalize(() => {
          'worklet';
          pointer.value = -1;
          if (!active.value) {
            return;
          }
          active.value = false;
          runOnJS(finish)(session.value);
        }),
    [
      enabled,
      allowTouchTrack,
      minimumValue,
      maximumValue,
      step,
      travel,
      thumbWidth,
      horizontalOverflow,
      position,
      active,
      pointer,
      session,
      startX,
      startLeft,
      begin,
      change,
      finish,
    ],
  );

  const thumbAnimation = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: validRange
          ? ((position.value - minimumValue) / (maximumValue - minimumValue)) *
            Math.max(0, travel)
          : 0,
      },
    ],
  }));
  const trackAnimation = useAnimatedStyle(() => ({
    width: validRange
      ? ((position.value - minimumValue) / (maximumValue - minimumValue)) *
          Math.max(0, travel) +
        thumbWidth / 2
      : 0,
  }));

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityState={{ disabled: !enabled }}
      accessibilityValue={{
        min: minimumValue,
        max: maximumValue,
        now: boundedValue,
      }}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setSize(previous =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
      }}
      style={[styles.container, style]}>
      <View
        pointerEvents="none"
        style={[
          styles.track,
          trackStyle,
          { backgroundColor: maximumTrackTintColor },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.track,
          styles.absolute,
          trackStyle,
          { backgroundColor: minimumTrackTintColor },
          trackAnimation,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.thumb, thumbStyle, thumbAnimation]}>
        {thumbProps?.children}
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          collapsable={false}
          style={[
            StyleSheet.absoluteFillObject,
            {
              left: -horizontalOverflow,
              right: -horizontalOverflow,
              top: -verticalOverflow,
              bottom: -verticalOverflow,
            },
          ]}
        />
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 40, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2 },
  absolute: { position: 'absolute', left: 0 },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
