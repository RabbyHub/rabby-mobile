import { Animated } from 'react-native';

const ABSOLUTE_INTERPOLATION_BOUND = 100_000;

export const getPerpsProMarketNaturalAnchor = ({
  headerHeight,
  regionAlertExtent,
}: {
  headerHeight: number;
  regionAlertExtent: number;
}) => headerHeight + regionAlertExtent;

export const getPerpsProMarketTop = ({
  headerMarketTop,
  naturalAnchorY,
  scrollY,
}: {
  headerMarketTop: number;
  naturalAnchorY: number;
  scrollY: number;
}) => Math.max(naturalAnchorY - scrollY, headerMarketTop);

export const createPerpsProMarketTranslateY = ({
  headerMarketTranslateY,
  naturalAnchorY,
  scrollY,
}: {
  headerMarketTranslateY: Animated.Animated;
  naturalAnchorY: number;
  scrollY: Animated.Animated;
}) => {
  const naturalTop = Animated.subtract(naturalAnchorY, scrollY);
  const difference = Animated.subtract(naturalTop, headerMarketTranslateY);
  const absoluteDifference = difference.interpolate({
    extrapolate: 'extend',
    inputRange: [
      -ABSOLUTE_INTERPOLATION_BOUND,
      0,
      ABSOLUTE_INTERPOLATION_BOUND,
    ],
    outputRange: [
      ABSOLUTE_INTERPOLATION_BOUND,
      0,
      ABSOLUTE_INTERPOLATION_BOUND,
    ],
  });

  // max(a, b) = (a + b + |a - b|) / 2. This keeps the alert's natural
  // scroll-away behavior and the Market sticky constraint on the native
  // Animated path without publishing a React state update for every frame.
  return Animated.divide(
    Animated.add(
      Animated.add(naturalTop, headerMarketTranslateY),
      absoluteDifference,
    ),
    2,
  );
};
