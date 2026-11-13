import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { IS_ANDROID } from '@/core/native/utils';
import { HomeTabName } from '@/hooks/navigation';

/** Height of the collapsing top bar (total balance + indicator row). */
export const HOME_SCENE_HEADER_HEIGHT = HOME_TOP_HEADER_SIZES.topHeaderHeight;

/** The tab strip starts slightly above the header's bottom edge. */
export const HOME_SCENE_TAB_BAR_TOP = HOME_TOP_HEADER_SIZES.headerHeight;

export const HOME_SCENE_TAB_BAR_HEIGHT =
  HOME_TOP_HEADER_SIZES.tabItemLineHeight;

/**
 * Breathing room between the tab labels and the first visible list row. The
 * chrome backdrop extends this far below the tab strip, and the asset pages
 * reserve the same space in their content inset.
 */
export const HOME_SCENE_TAB_BAR_BOTTOM_GAP = 12;

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
    HOME_SCENE_HEADER_HEIGHT +
    HOME_TOP_HEADER_SIZES.scrollableListTopOffset +
    HOME_SCENE_TAB_BAR_BOTTOM_GAP
  );
}

/** Where each page's content starts, i.e. how far the chrome backdrop reaches. */
export const HOME_SCENE_CHROME_BOTTOM = {
  assets: getHomeSceneContentInset(HomeTabName.token),
  overview: getHomeSceneContentInset(HomeTabName.overview),
} as const;

/** Inset used by the pager's own geometry (the tallest page). */
export const HOME_SCENE_CONTENT_TOP = HOME_SCENE_CHROME_BOTTOM.assets;
