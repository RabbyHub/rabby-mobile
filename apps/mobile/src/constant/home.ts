import { IS_ANDROID } from '@/core/native/utils';

export const HOME_REFRESH_INTERVAL = 10 * 60 * 1000;
export const ITEM_LAYOUT_PADDING_HORIZONTAL = 16;
export const ITEM_GRID_GAP = 10;
export const USE_PULL_REFRESH_INDICATOR_ON_ANDROID = false;
export const SHOULD_SHOW_INDICATOR_WHEN_LOADING =
  !IS_ANDROID || USE_PULL_REFRESH_INDICATOR_ON_ANDROID;

export const HOME_TOP_HEADER_SIZES = {
  headerHeight: 52,
  headerIndicatorHeight: 6,
  tabItemHeight: 54,
  bottomOffsetIndicator: 12,
  get scrollableListTopOffset() {
    return this.tabItemHeight + this.headerIndicatorHeight;
  },
  portfolioContainerPx: 16,
};
