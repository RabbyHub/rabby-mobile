import { HOME_TOP_HEADER_SIZES } from '@/constant/home';

export const TAB_HEADER_FULL_HEIGHT =
  HOME_TOP_HEADER_SIZES.headerHeight +
  HOME_TOP_HEADER_SIZES.scrollableListTopOffset;

export const enum HomeTabName {
  overview = 'overview',
  token = 'token',
  defi = 'defi',
  nft = 'nft',
}

export { HomeTabName as TabName };
