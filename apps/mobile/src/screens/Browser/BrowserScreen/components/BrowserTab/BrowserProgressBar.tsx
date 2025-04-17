import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export function BrowserProgressBar({
  progress,
  isLoading,
  style,
}: {
  progress: number;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useTheme2024({
    getStyle,
  });

  const width = useSharedValue(0);
  const targetProgress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    // 始终向目标值动画，但不会显示比当前小的值
    width.value = withTiming(Math.max(width.value, targetProgress.value), {
      duration: 300,
    });

    return {
      width: `${width.value * 100}%`,
    };
  });

  React.useEffect(() => {
    targetProgress.value = progress;
    // 加载完成时强制完成动画
    if (progress === 1) {
      width.value = withTiming(1, { duration: 200 });
    }
  }, [progress, targetProgress, width]);

  return (
    <View style={[styles.progressBar, style]}>
      <Animated.View style={[styles.progress, animatedStyle]} />
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  progressBar: {
    height: 4,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  progress: {
    backgroundColor: colors2024['brand-default'],
    height: '100%',
  },
}));
