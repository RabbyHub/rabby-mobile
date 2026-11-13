import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { IS_ANDROID } from '@/core/native/utils';
import { HomeTabName } from '@/hooks/navigation';

/** Height of the collapsing top bar (total balance + indicator row). */
export const HOME_SCENE_HEADER_HEIGHT = HOME_TOP_HEADER_SIZES.topHeaderHeight;

/** The tab strip starts slightly above the header's bottom edge. */
export const HOME_SCENE_TAB_BAR_TOP = HOME_TOP_HEADER_SIZES.headerHeight;

export const HOME_SCENE_TAB_BAR_HEIGHT =
  HOME_TOP_HEADER_SIZES.tabItemLineHeight;

export const HOME_SCENE_TABS: readonly HomeTabName[] = [
  HomeTabName.overview,
  HomeTabName.token,
  HomeTabName.defi,
  HomeTabName.nft,
];

/**
 * Space each page reserves for the floating scene layers. The overview page
 * keeps its own smaller lead-in: its tab labels row is hidden there, so the
 * asset lists sit one label row lower.
 */
export function getHomeSceneContentInset(tab: HomeTabName) {
  if (tab === HomeTabName.overview) {
    return (
      HOME_SCENE_HEADER_HEIGHT +
      (IS_ANDROID ? HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset : 0)
    );
  }
  return (
    HOME_SCENE_HEADER_HEIGHT + HOME_TOP_HEADER_SIZES.scrollableListTopOffset
  );
}

/** Inset used by the pager's own geometry (the tallest page). */
export const HOME_SCENE_CONTENT_TOP = getHomeSceneContentInset(
  HomeTabName.token,
);
