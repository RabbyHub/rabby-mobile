import { Animated } from 'react-native';

const ABSOLUTE_INTERPOLATION_BOUND = 100_000;

export const PERPS_PRO_INFO_TABS_HEIGHT = 34;
export const PERPS_PRO_INFO_SECTION_TOP_GAP = 16;
export const PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT =
  PERPS_PRO_INFO_SECTION_TOP_GAP + PERPS_PRO_INFO_TABS_HEIGHT;
const PERPS_PRO_INFO_EMPTY_STATE_VISIBLE_HEIGHT = 80 + 126 + 12 + 18;
const PERPS_PRO_INFO_MIN_BOTTOM_PADDING = 32;

export const getPerpsProInfoTabsNaturalAnchor = ({
  leadInHeight,
  tradeRowHeight,
}: {
  leadInHeight: number;
  tradeRowHeight: number;
}) => leadInHeight + tradeRowHeight + PERPS_PRO_INFO_SECTION_TOP_GAP;

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

export const getPerpsProPopulatedInfoSectionBottomPadding = ({
  marketBarHeight,
  viewportHeight,
}: {
  marketBarHeight: number;
  viewportHeight: number;
}) => {
  if (
    !Number.isFinite(viewportHeight) ||
    viewportHeight <= 0 ||
    !Number.isFinite(marketBarHeight) ||
    marketBarHeight <= 0
  ) {
    return PERPS_PRO_INFO_MIN_BOTTOM_PADDING;
  }

  // Match the distance below the approved empty-state composition:
  // 80 top + 126 icon + 12 gap + one 18px message line.
  return Math.max(
    viewportHeight -
      marketBarHeight -
      PERPS_PRO_INFO_TABS_HEIGHT -
      PERPS_PRO_INFO_EMPTY_STATE_VISIBLE_HEIGHT,
    PERPS_PRO_INFO_MIN_BOTTOM_PADDING,
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
}) => Math.max(anchorY - scrollY, marketTranslateY + 40);

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
