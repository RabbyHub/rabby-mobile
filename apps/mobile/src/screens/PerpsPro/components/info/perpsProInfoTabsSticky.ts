import { Animated } from 'react-native';

const ABSOLUTE_INTERPOLATION_BOUND = 100_000;

export const PERPS_PRO_INFO_TABS_HEIGHT = 44;
// Figma 86609:348308: the tabs follow the trade row after 20pt, no divider.
export const PERPS_PRO_INFO_SECTION_TOP_GAP = 20;
export const PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT =
  PERPS_PRO_INFO_SECTION_TOP_GAP + PERPS_PRO_INFO_TABS_HEIGHT;
export const PERPS_PRO_INFO_SECTION_BOTTOM_PADDING = 36;
// The bg-1 → bg-0 band spans the lead gap and the tabs. The sticky tabs start
// their gradient above themselves so they continue the in-list band exactly.
export const PERPS_PRO_INFO_TABS_GRADIENT_START = {
  x: 0,
  y: -PERPS_PRO_INFO_SECTION_TOP_GAP / PERPS_PRO_INFO_TABS_HEIGHT,
};
// Same x as the start keeps the band vertical; the library's default end
// (x 0.5) would slant it across the strip.
export const PERPS_PRO_INFO_TABS_GRADIENT_END = { x: 0, y: 1 };

// The controls below the tabs stick with them, so their heights are fixed:
// Positions keeps 12pt around the 24pt row (Figma 87900:107683); Open Orders
// uses 8pt above the row, 4pt to the 30pt category chips and 8pt below.
export const PERPS_PRO_INFO_CONTROLS_ROW_HEIGHT = 24;
export const PERPS_PRO_POSITIONS_CONTROLS_INSET = 12;
export const PERPS_PRO_POSITIONS_CONTROLS_HEIGHT =
  PERPS_PRO_POSITIONS_CONTROLS_INSET * 2 + PERPS_PRO_INFO_CONTROLS_ROW_HEIGHT;
export const PERPS_PRO_OPEN_ORDERS_CONTROLS_TOP = 8;
export const PERPS_PRO_OPEN_ORDERS_CONTROLS_ROW_GAP = 4;
export const PERPS_PRO_OPEN_ORDERS_CATEGORY_HEIGHT = 30;
export const PERPS_PRO_OPEN_ORDERS_CONTROLS_BOTTOM = 8;
export const PERPS_PRO_OPEN_ORDERS_CONTROLS_HEIGHT =
  PERPS_PRO_OPEN_ORDERS_CONTROLS_TOP +
  PERPS_PRO_INFO_CONTROLS_ROW_HEIGHT +
  PERPS_PRO_OPEN_ORDERS_CONTROLS_ROW_GAP +
  PERPS_PRO_OPEN_ORDERS_CATEGORY_HEIGHT +
  PERPS_PRO_OPEN_ORDERS_CONTROLS_BOTTOM;

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
