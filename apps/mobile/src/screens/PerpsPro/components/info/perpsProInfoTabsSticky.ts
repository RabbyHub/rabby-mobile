export const PERPS_PRO_INFO_TABS_HEIGHT = 44;
// Figma 86609:348308: the tabs follow the trade row after 20pt, no divider.
export const PERPS_PRO_INFO_SECTION_TOP_GAP = 20;
export const PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT =
  PERPS_PRO_INFO_SECTION_TOP_GAP + PERPS_PRO_INFO_TABS_HEIGHT;
export const PERPS_PRO_INFO_SECTION_BOTTOM_PADDING = 36;

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
