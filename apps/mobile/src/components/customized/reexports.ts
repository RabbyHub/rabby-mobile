export {
  TouchableOpacity as RNTouchableOpacity,
  View as RNView,
  Animated as RNAnimated,
} from 'react-native';

export {
  TouchableOpacity as RNGHTouchableOpacity,
  type TouchableOpacityProps as RNGHTouchableOpacityProps,
  Pressable as RNGHPressable,
  type PressableProps as RNGHPressableProps,
  ScrollView as RNGHScrollView,
  RefreshControl as RNGHRefreshControl,
} from 'react-native-gesture-handler';

export type RNGHScrollViewProps = React.ComponentProps<
  typeof import('react-native-gesture-handler').ScrollView
>;

export { default as ReAnimated } from 'react-native-reanimated';
