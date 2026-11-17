import { makeMutable } from 'react-native-reanimated';

/**
 * One decision point for every drag that starts on the Home first floor.
 *
 * Nothing here drives anything: each participant (the asset pager gate, the
 * dapp drawer pan, the drawer's tab-strip pan) reports the drag it sees and
 * then acts on the shared verdict. The first participant to reach a threshold
 * decides the axis for the whole touch sequence; everybody else yields.
 *
 * This exists because the native pager cannot join RNGH's gesture graph
 * without swallowing the gesture, so the Home can only have a shared verdict,
 * not a shared gesture. See
 * codex-rabby/plans/rabby-mobile-home-gesture-single-authority-20261115.md.
 */

export const HOME_GESTURE_AXIS = {
  UNDECIDED: 0,
  HORIZONTAL: 1,
  VERTICAL: 2,
} as const;

export type HomeGestureAxis =
  (typeof HOME_GESTURE_AXIS)[keyof typeof HOME_GESTURE_AXIS];

/** A horizontal lead has to clear this before it owns the drag. */
export const HOME_GESTURE_HORIZONTAL_SLOP = 12;
/** A vertical lead has to clear this before it owns the drag. */
export const HOME_GESTURE_VERTICAL_SLOP = 8;
/** A vertical lead also has to be this much larger than the horizontal one. */
export const HOME_GESTURE_VERTICAL_RATIO = 1.2;

export const homeGestureAuthority = {
  axis: makeMutable<HomeGestureAxis>(HOME_GESTURE_AXIS.UNDECIDED),
  startX: makeMutable(0),
  startY: makeMutable(0),
};

export function beginHomeGesture(x: number, y: number) {
  'worklet';
  homeGestureAuthority.axis.value = HOME_GESTURE_AXIS.UNDECIDED;
  homeGestureAuthority.startX.value = x;
  homeGestureAuthority.startY.value = y;
}

/**
 * Resolve the axis for this drag. Once decided it stays decided until the next
 * `beginHomeGesture`, so every participant sees the same verdict.
 */
export function resolveHomeGestureAxis(x: number, y: number): HomeGestureAxis {
  'worklet';
  const decided = homeGestureAuthority.axis.value;
  if (decided !== HOME_GESTURE_AXIS.UNDECIDED) {
    return decided;
  }

  const dx = Math.abs(x - homeGestureAuthority.startX.value);
  const dy = Math.abs(y - homeGestureAuthority.startY.value);

  if (
    dy >= HOME_GESTURE_VERTICAL_SLOP &&
    dy > dx * HOME_GESTURE_VERTICAL_RATIO
  ) {
    homeGestureAuthority.axis.value = HOME_GESTURE_AXIS.VERTICAL;
  } else if (dx > HOME_GESTURE_HORIZONTAL_SLOP && dx > dy) {
    homeGestureAuthority.axis.value = HOME_GESTURE_AXIS.HORIZONTAL;
  }

  return homeGestureAuthority.axis.value;
}

export function endHomeGesture() {
  'worklet';
  homeGestureAuthority.axis.value = HOME_GESTURE_AXIS.UNDECIDED;
}
