export const HOME_REFRESH_INTERVAL = 10 * 60 * 1000;
export const ITEM_LAYOUT_PADDING_HORIZONTAL = 16;
export const ITEM_GRID_GAP = 10;

export const HOME_TOP_HEADER_SIZES = {
  headerHeight: 52,
  headerPaddingY: 14,
  headerIndicatorHeight: 6,
  tabItemHeight: 54,
  get scrollableListTopOffset() {
    return this.tabItemHeight + this.headerIndicatorHeight;
  },
  portfolioContainerPx: 16,
};
