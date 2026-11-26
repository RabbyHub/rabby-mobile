import { HOME_TOP_HEADER_SIZES } from '@/constant/home';

/** Title row plus the two-segment indicator, as on the first floor. */
export const DRAWER_TOP_BAR_HEIGHT = HOME_TOP_HEADER_SIZES.topHeaderHeight;
/** Space between the indicator and the website category strip. */
export const DRAWER_CATEGORY_BAR_GAP = 10;
export const DRAWER_CATEGORY_BAR_HEIGHT = 28;

/** Where a "More Features" page starts: right under the indicator. */
export const DRAWER_MORE_CONTENT_TOP = DRAWER_TOP_BAR_HEIGHT + 12;
/** Where a website page starts: under the category strip. */
export const DRAWER_WEBSITES_CONTENT_TOP =
  DRAWER_TOP_BAR_HEIGHT + DRAWER_CATEGORY_BAR_GAP + DRAWER_CATEGORY_BAR_HEIGHT;
