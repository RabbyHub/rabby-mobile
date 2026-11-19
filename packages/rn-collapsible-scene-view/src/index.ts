// Minimal public surface for the retained root scene pager.
//
// This package started as the Perps collapsible-scene work; the Swap/Bridge
// paging experiment only needs the root pager primitive, so the other exports
// stay out of this branch until they are pulled in with their own feature.
export {
  RootScenePager,
  RootScenePagerGestureBlock,
  type RootScenePagerGestureMode,
  type RootScenePagerProps,
  type RootScenePageContext,
  type RootSceneOverlayContext,
  type RootScenePagerUI,
} from './RootScenePager';
