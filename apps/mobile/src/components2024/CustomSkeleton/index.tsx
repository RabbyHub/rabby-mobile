import { Skeleton, SkeletonProps } from '@rneui/themed';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface CustomSkeletonProps extends SkeletonProps {
  speed?: number;
  pulseEnabled?: boolean;
}

export const CustomSkeleton = ({
  speed = 300,
  pulseEnabled = true,
  ...props
}: CustomSkeletonProps) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!pulseEnabled) {
      return;
    }
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: speed, // 控制动画速度
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: speed,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [speed, opacity, pulseEnabled]);

  return (
    <Animated.View style={{ opacity }}>
      <Skeleton {...props} />
    </Animated.View>
  );
};
