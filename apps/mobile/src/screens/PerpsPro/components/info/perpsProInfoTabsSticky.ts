import { Animated } from 'react-native';

const ABSOLUTE_INTERPOLATION_BOUND = 100_000;

export const PERPS_PRO_INFO_TABS_HEIGHT = 44;
export const PERPS_PRO_INFO_SECTION_TOP_GAP = 16;
export const PERPS_PRO_INFO_SECTION_DIVIDER_HEIGHT = 6;
export const PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT =
  PERPS_PRO_INFO_SECTION_TOP_GAP +
  PERPS_PRO_INFO_SECTION_DIVIDER_HEIGHT +
  PERPS_PRO_INFO_TABS_HEIGHT;
export const PERPS_PRO_INFO_SECTION_BOTTOM_PADDING = 36;

export const getPerpsProInfoTabsNaturalAnchor = ({
  leadInHeight,
  tradeRowHeight,
}: {
  leadInHeight: number;
  tradeRowHeight: number;
}) =>
  leadInHeight +
  tradeRowHeight +
  PERPS_PRO_INFO_SECTION_TOP_GAP +
  PERPS_PRO_INFO_SECTION_DIVIDER_HEIGHT;

export const getPerpsProInfoSectionMinimumContentHeight = ({
  infoTabsNaturalAnchor,
  marketBarHeight,
  viewportHeight,
}: {
  infoTabsNaturalAnchor: number;
  marketBarHeight: number;
  viewportHeight: number;
}) => {
  const safeViewportHeight =
    Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
  const safeInfoTabsNaturalAnchor =
    Number.isFinite(infoTabsNaturalAnchor) && infoTabsNaturalAnchor > 0
      ? infoTabsNaturalAnchor
      : 0;
  const safeMarketBarHeight =
    Number.isFinite(marketBarHeight) && marketBarHeight > 0
      ? marketBarHeight
      : 0;

  return (
    safeViewportHeight +
    Math.max(safeInfoTabsNaturalAnchor - safeMarketBarHeight, 0)
  );
};

export const getPerpsProInfoTabsTop = ({
  anchorY,
  marketTranslateY,
  scrollY,
}: {
  anchorY: number;
  marketTranslateY: number;
  scrollY: number;
}) => {
  'worklet';
  return Math.max(anchorY - scrollY, marketTranslateY + 40);
};

export const createPerpsProInfoTabsTranslateY = ({
  anchorY,
  marketBarHeight,
  marketTranslateY,
  scrollY,
}: {
  anchorY: number;
  marketBarHeight: number;
  marketTranslateY: Animated.Animated;
  scrollY: Animated.Animated;
}) => {
  const naturalTop = Animated.subtract(anchorY, scrollY);
  const marketBottom = Animated.add(marketTranslateY, marketBarHeight);
  const difference = Animated.subtract(naturalTop, marketBottom);
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

  // max(a, b) = (a + b + |a - b|) / 2. Keeping this expression inside
  // Animated lets the tab follow the list and the moving Market overlay on the
  // native driver without a JS setState on every scroll event.
  return Animated.divide(
    Animated.add(Animated.add(naturalTop, marketBottom), absoluteDifference),
    2,
  );
};
