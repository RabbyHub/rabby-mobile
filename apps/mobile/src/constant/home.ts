import { IS_ANDROID } from '@/core/native/utils';

export const HOME_REFRESH_INTERVAL = 10 * 60 * 1000;
export const ITEM_LAYOUT_PADDING_HORIZONTAL = 16;
export const ITEM_GRID_GAP = 10;

export const HOME_TOP_HEADER_SIZES = {
  headerHeight: 52,
  // headerHeight: 0,
  headerIndicatorHeight: 6,
  homecardOffsetFromIndicator: 12,
  tabItemHeight: 54,
  get scrollableListTopOffset() {
    // return this.tabItemHeight + this.headerIndicatorHeight;
    return this.tabItemHeight;
  },
  get tabInnerHomeTopOffset() {
    return this.headerIndicatorHeight + this.homecardOffsetFromIndicator;
  },
  portfolioContainerPx: 16,
};
