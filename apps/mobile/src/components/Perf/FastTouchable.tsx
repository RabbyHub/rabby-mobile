import React, { useCallback } from 'react';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const LONG_PRESS_MIN_DURATION = 400;

export const FastTouchable = ({
  style,
  children = null,
  activeOpacity = 0.2,
  disabled = false,
  testID,
  onPress: prop_onPress,
  onLongPress: prop_onLongPress,
}: RNViewProps & {
  children?: React.ReactNode;
  activeOpacity?: number;
  /** Ignore touches without unmounting the gesture, e.g. while editing. */
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) => {
  const opacity = useSharedValue(1);

  const onPress = useCallback(() => {
    prop_onPress?.();
  }, [prop_onPress]);

  const onLongPress = useCallback(() => {
    prop_onLongPress?.();
  }, [prop_onLongPress]);

  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      opacity.value = withTiming(activeOpacity, { duration: 50 });
      console.debug('[FastTouchable] onBegin');
    })
    .onEnd(() => {
      console.debug('[FastTouchable] onEnd');
      runOnJS(onPress)?.();
    })
    .onFinalize(() => {
      opacity.value = withTiming(1, { duration: 100 });
    });

  // The long press outranks the tap: holding fires only the long press, a
  // quick touch still ends as a tap once the long press has failed.
  const gesture = prop_onLongPress
    ? Gesture.Exclusive(
        Gesture.LongPress()
          .enabled(!disabled)
          .minDuration(LONG_PRESS_MIN_DURATION)
          .onStart(() => {
            runOnJS(onLongPress)();
          }),
        tapGesture,
      )
    : tapGesture;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View testID={testID} style={[animatedStyle, style]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};
