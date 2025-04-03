import { Skeleton, SkeletonProps } from '@rneui/themed';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface CustomSkeletonProps extends SkeletonProps {
  speed?: number;
}

export const CustomSkeleton = ({
  speed = 300,
  ...props
}: CustomSkeletonProps) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
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
  }, [speed, opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <Skeleton {...props} />
    </Animated.View>
  );
};
