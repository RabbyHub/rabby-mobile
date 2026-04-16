import React, { useCallback } from 'react';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

export const FastTouchable = ({
  style,
  children = null,
  activeOpacity = 0.2,
  onPress: prop_onPress,
}: RNViewProps & {
  children?: React.ReactNode;
  activeOpacity?: number;
  onPress?: () => void;
}) => {
  const opacity = useSharedValue(1);

  const onPress = useCallback(() => {
    prop_onPress?.();
  }, [prop_onPress]);

  const tapGesture = Gesture.Tap()
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

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </GestureDetector>
  );
};
