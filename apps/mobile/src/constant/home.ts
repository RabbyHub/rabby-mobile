import { IS_ANDROID } from '@/core/native/utils';

export const HOME_REFRESH_INTERVAL = 10 * 60 * 1000;
export const ITEM_LAYOUT_PADDING_HORIZONTAL = 16;
export const ITEM_GRID_GAP = 10;
export const SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING = !IS_ANDROID;

export const HOME_TOP_HEADER_SIZES = {
  headerHeight: 52,
  // headerHeight: 0,
  headerIndicatorHeight: 6,
  headerOffsetAfterIndicator: 8,
  headerTabItemHeight: 32,
  headerOffsetAfterTabItem: 8,
  get tabItemLineHeight() {
    return (
      HOME_TOP_HEADER_SIZES.headerIndicatorHeight +
      HOME_TOP_HEADER_SIZES.headerOffsetAfterIndicator +
      HOME_TOP_HEADER_SIZES.headerTabItemHeight +
      HOME_TOP_HEADER_SIZES.headerOffsetAfterTabItem
    );
  },
  homecardOffsetFromIndicator: 12,
  get topHeaderHeight() {
    return (
      HOME_TOP_HEADER_SIZES.headerHeight +
      HOME_TOP_HEADER_SIZES.headerIndicatorHeight
    );
  },
  get scrollableListTopOffset() {
    return (
      HOME_TOP_HEADER_SIZES.tabItemLineHeight -
      HOME_TOP_HEADER_SIZES.headerIndicatorHeight -
      (SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING
        ? HOME_TOP_HEADER_SIZES.headerOffsetAfterTabItem
        : 0)
    );
  },
  get tabInnerHomeTopOffset() {
    return HOME_TOP_HEADER_SIZES.homecardOffsetFromIndicator;
  },
  portfolioContainerPx: 16,
};
