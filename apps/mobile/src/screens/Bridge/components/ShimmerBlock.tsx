import React, { useEffect } from 'react';
import { View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

const getStyle = createGetStyles2024(() => ({}));

/**
 * Neutral horizontal shimmer for a small reserved slot. Runs on the UI thread
 * and never affects layout or JS rendering.
 */
export const ShimmerBlock = ({ size = 18 }: { size?: number }) => {
  const { isLight } = useTheme2024({ getStyle });
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1300 }), -1, false);
    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: -size * 1.4 + progress.value * size * 2.8,
      },
    ],
  }));

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: isLight
          ? 'rgba(0,0,0,0.04)'
          : 'rgba(255,255,255,0.06)',
      }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: size * 1.4,
          },
          bandStyle,
        ]}>
        <LinearGradient
          colors={
            isLight
              ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0)']
              : [
                  'rgba(255,255,255,0)',
                  'rgba(255,255,255,0.18)',
                  'rgba(255,255,255,0)',
                ]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
};
