import { IS_ANDROID } from '@/core/native/utils';

import { Platform } from 'react-native';
import { svsLayout } from '@/hooks/useAppLayout';
import { triggerImpact } from '@/utils/common';
import {
  makeMutable,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated';

export const SCROLLABLE_STATUS = {
  LOCKED: 'LOCKED',
  UNLOCKED: 'UNLOCKED',
} as const;

export type SCROLLABLE_STATUS =
  (typeof SCROLLABLE_STATUS)[keyof typeof SCROLLABLE_STATUS];

export const SCROLLABLE_DECELERATION_RATE_MAPPER = {
  [SCROLLABLE_STATUS.LOCKED]: 0,
  [SCROLLABLE_STATUS.UNLOCKED]: Platform.select({
    ios: 0.998,
    android: 0.985,
    default: 1,
  }),
};

const PULL_THRESHOLD = 100;

// export const THRESHOLD_PERCENT = (PULL_THRESHOLD / scrWinHeight) * 100;
export const THRESHOLD_PERCENT = 8;

export function getPullThreshold(
  height: number = svsLayout.screenLayout.value.height,
) {
  'worklet';
  // return Math.min(height * 0.3, PULL_THRESHOLD);
  return Math.min(height * THRESHOLD_PERCENT * 0.01 + 16, PULL_THRESHOLD);
}

export const homeDrawerAnimateMutable = {
  tabsOpacity: makeMutable(1),
  pullPercent: makeMutable(0),
  isExpanded: makeMutable(false),
  translateY: makeMutable(0),
  /**
   * How far the drawer panel is "revealed" (0 -> 0.75 scale, 1 -> full size).
   *
   * It follows `pullPercent` while the drawer is opening, but it is latched
   * while closing so the panel keeps its size and only translates down. The
   * first floor only translates, so shrinking the panel during the close made
   * the two layers move at different apparent speeds.
   */
  panelReveal: makeMutable(0),

  scrollViewContentHeight: makeMutable(0),
  scrollViewLayoutHeight: makeMutable(0),
  swipeUpHintHeight: makeMutable(0),
  /**
   * Where the first floor's own content ends inside its scroll view: the
   * bottom edge of the swipe-up hint's box. Whatever the scroll content has
   * below it is padding.
   */
  firstFloorContentEnd: makeMutable(0),

  /**
   * 0 outside the feature-card edit mode. While the cards are edited the two
   * floors read as one page, and this is how far they travel between the
   * Home and the second floor: less than a screen, so that the second floor
   * starts right under the Home's swipe-up hint instead of a screen below
   * the first floor's top. Pass its value to `getHomeFloorTravel`.
   */
  editingFloorTravel: makeMutable(0),

  /**
   * Page position of the second floor's own pager: 0 is "More Features",
   * 1 and up are the website categories. Written by the drawer's tab bar,
   * read by whatever sits outside that pager (the drawer footer).
   */
  drawerTabPosition: makeMutable(0),
};

const { editingFloorTravel } = homeDrawerAnimateMutable;

/**
 * The tap felt when a swipe switches floors: far enough up from the Home to
 * open the second floor, or far enough down from it to go back. Not while
 * the feature cards are edited: the two floors are then one page, and moving
 * along it does not switch anything.
 */
export function impactOnFloorSwitch() {
  'worklet';
  if (editingFloorTravel.value > 0) {
    return;
  }
  runOnJS(triggerImpact)();
}

/** The two floors never travel less than this share of the screen. */
const MIN_FLOOR_TRAVEL_RATIO = 0.35;

/**
 * How far the two floors move on screen between the Home and the second
 * floor. `translateY` and `pullPercent` always span a full screen; this is
 * the distance that span is drawn over, and the distance a finger has to
 * cover for it.
 *
 * `editingTravel` is `editingFloorTravel.value`. It is a parameter so that
 * an animated style or reaction reads the shared value itself: one read
 * inside this helper would not be tracked, and the style would keep the old
 * distance when the edit mode changes.
 */
export function getHomeFloorTravel(
  screenHeight: number,
  editingTravel: number,
) {
  'worklet';
  if (editingTravel <= 0 || screenHeight <= 0) {
    return screenHeight;
  }

  return Math.min(
    screenHeight,
    Math.max(editingTravel, screenHeight * MIN_FLOOR_TRAVEL_RATIO),
  );
}

/**
 * Whether the first floor's list has to be held at its very end. Whatever
 * shows right above the second floor is that end, and the list's distance to
 * it keeps changing: its content resizes (a card moved up from the second
 * floor adds a row, entering or leaving edit mode resizes the hint) and its
 * viewport resizes with the Home header all along the drawer's travel.
 *
 * - Drawer resting fully open: yes.
 * - Feature-card edit mode: yes, for as long as any of the drawer is on
 *   screen. The two floors read as one page there, and the first floor stays
 *   less than a screen away behind a drawer panel with no background of its
 *   own, so anything short of its end shows through the second floor.
 * - Otherwise no: on the drawer's way down the list is scrolled back to its
 *   top.
 *
 * The arguments are the shared values' current values, as for
 * `getHomeFloorTravel`.
 */
export function shouldHoldFirstFloorAtEnd(
  drawerTranslateY: number,
  screenHeight: number,
  editingTravel: number,
) {
  'worklet';
  if (screenHeight <= 0) {
    return false;
  }
  if (drawerTranslateY <= -screenHeight) {
    return true;
  }

  return editingTravel > 0 && drawerTranslateY < 0;
}

export function getScrollContainerPb(bottomInset: number) {
  'worklet';
  return Math.max(IS_ANDROID ? Math.max(bottomInset, 16) : bottomInset, 48);
}

export function useHomeDrawerOpacityStyle() {
  const tabsOpacity = homeDrawerAnimateMutable.tabsOpacity;
  const pullPercent = homeDrawerAnimateMutable.pullPercent;
  const opacityStyle = useAnimatedStyle(() => ({
    opacity: tabsOpacity.value,
    pointerEvents: tabsOpacity.value < 0.1 ? 'none' : 'auto',
  }));

  return { pullPercent, tabsOpacity, opacityStyle };
}
