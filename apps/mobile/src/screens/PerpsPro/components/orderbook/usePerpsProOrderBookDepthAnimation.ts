import { useEffect, useLayoutEffect, useRef } from 'react';
import { Animated, Easing, useAnimatedValue } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const DEPTH_EASING = Easing.bezier(0, 0, 0.2, 1);

type DepthPresentation = {
  animationIdentity: string;
  price: string;
  targetPercent: number;
};

export const usePerpsProOrderBookDepthAnimation = ({
  animationIdentity,
  price,
  targetPercent,
}: DepthPresentation): Animated.Value => {
  const targetScale =
    (Number.isFinite(targetPercent)
      ? Math.max(0, Math.min(100, targetPercent))
      : 0) / 100;
  const scale = useAnimatedValue(targetScale, { useNativeDriver: true });
  const reducedMotion = useReducedMotion();
  const previousRef = useRef<{
    animationIdentity: string;
    price: string;
    targetScale: number;
  } | null>(null);

  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { animationIdentity, price, targetScale };

    if (
      previous === null ||
      previous.animationIdentity !== animationIdentity ||
      previous.price !== price ||
      reducedMotion
    ) {
      // setValue also cancels an in-flight animation before snapping.
      scale.setValue(targetScale);
      return;
    }
    if (previous.targetScale === targetScale) {
      return;
    }

    Animated.timing(scale, {
      toValue: targetScale,
      duration: 250,
      easing: DEPTH_EASING,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }, [animationIdentity, price, reducedMotion, scale, targetScale]);

  useEffect(() => () => scale.stopAnimation(), [scale]);

  return scale;
};
