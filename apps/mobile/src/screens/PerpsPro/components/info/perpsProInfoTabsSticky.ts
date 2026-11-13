export const PERPS_PRO_INFO_TABS_HEIGHT = 38;
export const PERPS_PRO_INFO_SECTION_TOP_GAP = 16;
export const PERPS_PRO_INFO_SECTION_DIVIDER_HEIGHT = 6;
export const PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT =
  PERPS_PRO_INFO_SECTION_TOP_GAP +
  PERPS_PRO_INFO_SECTION_DIVIDER_HEIGHT +
  PERPS_PRO_INFO_TABS_HEIGHT;
const PERPS_PRO_INFO_EMPTY_STATE_VISIBLE_HEIGHT = 80 + 126 + 12 + 18;
const PERPS_PRO_INFO_MIN_BOTTOM_PADDING = 32;

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
