import { Dimensions, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { useOpenedActiveDappState } from '../hooks/useDappWebViewScreen';
import { DappWebViewStubScreen } from './index';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const winLayout = Dimensions.get('window');
const winHeight = winLayout.height;
export default function GlobalDappWebViews() {
  const { styles } = useTheme2024({ getStyle });

  const { hasActiveDapp } = useOpenedActiveDappState();

  const shownAnimated = useSharedValue(0);

  useAnimatedReaction(
    () => (hasActiveDapp ? 1 : 0),
    (cur, prev) => {
      shownAnimated.value = !cur
        ? withTiming(0, {
            duration: 150,
          })
        : withTiming(1, {
            duration: 300,
          });
    },
  );

  // make aniation on show based on react-native-reanimated
  // slide from bottom
  const animatedViewStyle = useAnimatedStyle(() => {
    return {
      opacity: shownAnimated.value,
      transform: [{ translateY: (1 - shownAnimated.value) * winHeight }],
    };
  });

  return (
    <View
      style={[
        styles.containerShape,
        { display: shownAnimated.value ? 'flex' : 'none' },
      ]}
      {...(!hasActiveDapp && { pointerEvents: 'box-none' })}>
      <Animated.View
        style={[
          styles.containerShape,
          styles.animatedLayer,
          animatedViewStyle,
        ]}>
        <DappWebViewStubScreen __AS_FULL_OVERLAY_WIN__ />
      </Animated.View>
    </View>
  );
}

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      // zIndex: 999,
      position: 'relative',
      backgroundColor: __DEV__ ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
    },
    containerShape: {
      height: '100%',
      width: '100%',
    },
    animatedLayer: {
      position: 'absolute',
      backgroundColor: 'transparent',
    },
  };
});
