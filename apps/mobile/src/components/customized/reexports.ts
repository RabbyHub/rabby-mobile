import Animated from 'react-native-reanimated';

export {
  TouchableOpacity as RNTouchableOpacity,
  View as RNView,
  Animated as RNAnimated,
} from 'react-native';
import { RefreshControl } from 'react-native';

import {
  TouchableOpacity as RNGHTouchableOpacity,
  type TouchableOpacityProps as RNGHTouchableOpacityProps,
  Pressable as RNGHPressable,
  type PressableProps as RNGHPressableProps,
  ScrollView as RNGHScrollView,
  RefreshControl as RNGHRefreshControl,
} from 'react-native-gesture-handler';

export {
  RNGHTouchableOpacity,
  type RNGHTouchableOpacityProps,
  RNGHPressable,
  type RNGHPressableProps,
  RNGHScrollView,
  RNGHRefreshControl,
};

export type RNGHScrollViewProps = React.ComponentProps<
  typeof import('react-native-gesture-handler').ScrollView
>;

export { default as ReAnimated } from 'react-native-reanimated';

export const AnimatedRefreshControl =
  Animated.createAnimatedComponent(RefreshControl);
export const AnimatedRNGHRefreshControl =
  Animated.createAnimatedComponent(RNGHRefreshControl);
