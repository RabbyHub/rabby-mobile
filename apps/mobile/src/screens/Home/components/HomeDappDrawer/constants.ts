import { HOME_TOP_HEADER_SIZES } from '@/constant/home';

/** Title row plus the two-segment indicator, as on the first floor. */
export const DRAWER_TOP_BAR_HEIGHT = HOME_TOP_HEADER_SIZES.topHeaderHeight;
/** Space between the indicator and the website category strip. */
export const DRAWER_CATEGORY_BAR_GAP = 12;
/** One chip of the website category strip. */
export const DRAWER_CATEGORY_CHIP_HEIGHT = 30;
/** The strip: its chips, with 6 of padding above and below them. */
export const DRAWER_CATEGORY_BAR_HEIGHT = DRAWER_CATEGORY_CHIP_HEIGHT + 12;

/** From the indicator to the first row of "More Features" cards. */
export const DRAWER_MORE_CONTENT_GAP = 12;
/** Where a website page starts: under the category strip. */
export const DRAWER_WEBSITES_CONTENT_TOP =
  DRAWER_TOP_BAR_HEIGHT + DRAWER_CATEGORY_BAR_GAP + DRAWER_CATEGORY_BAR_HEIGHT;
/** From the category strip to the first dapp card, and between two cards. */
export const DRAWER_DAPP_CARD_GAP = 8;
