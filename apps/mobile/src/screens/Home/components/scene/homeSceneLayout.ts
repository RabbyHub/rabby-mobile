import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
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
 * hides the tab labels row, so it reserves only the single block gap between
 * the indicator row and its balance card; asset pages also reserve the row.
 */
export function getHomeSceneContentInset(tab: HomeTabName) {
  if (tab === HomeTabName.overview) {
    // The overview page has no visible tab strip: its balance card sits right
    // below the indicator row with the same gap it has above the entry matrix.
    return (
      HOME_SCENE_HEADER_HEIGHT + HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset
    );
  }
  return (
    HOME_SCENE_HEADER_HEIGHT + HOME_TOP_HEADER_SIZES.scrollableListTopOffset
  );
}

/** Where each page's content starts, i.e. how far the chrome backdrop reaches. */
export const HOME_SCENE_CHROME_BOTTOM = {
  assets: getHomeSceneContentInset(HomeTabName.token),
  overview: getHomeSceneContentInset(HomeTabName.overview),
} as const;

/** Inset used by the pager's own geometry (the tallest page). */
export const HOME_SCENE_CONTENT_TOP = HOME_SCENE_CHROME_BOTTOM.assets;
