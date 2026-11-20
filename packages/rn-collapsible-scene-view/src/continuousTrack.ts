/**
 * Continuous horizontal track math.
 *
 * One track position (float, in page units) is the single source of truth for
 * a linked pager's presentation. A drag writes it directly, so the track can
 * rest anywhere the finger leaves it; settling is a separate, explicit step.
 */

export type TrackRange = {
  /** Never greater than `end`. */
  start: number;
  end: number;
};

export type LinkedTrackSettleMode = 'snap' | 'free';

const finite = (value: number, fallback: number) => {
  'worklet';
  return Number.isFinite(value) ? value : fallback;
};

export const clampTrackPosition = (
  value: number,
  range: TrackRange,
): number => {
  'worklet';
  const min = Math.min(range.start, range.end);
  const max = Math.max(range.start, range.end);
  return Math.min(Math.max(finite(value, min), min), max);
};

/**
 * Splits a drag delta into the part a track consumes and the overflow that
 * chains to its parent track (the basis for nested multi-level paging).
 */
export const splitTrackDelta = ({
  delta,
  range,
  start,
}: {
  delta: number;
  range: TrackRange;
  start: number;
}): { overflow: number; position: number } => {
  'worklet';
  const raw = finite(start, range.start) + finite(delta, 0);
  const position = clampTrackPosition(raw, range);
  return { overflow: raw - position, position };
};

/**
 * Where the track comes to rest after the finger lifts.
 *
 * - `free`: park exactly where the finger left it (any intermediate position);
 * - `snap`: at most one page away from the page the gesture started on. The
 *   displacement decides the direction; the release velocity only breaks the
 *   "did not travel half a page" case, and never adds distance. A slow drag
 *   that stops short of half a page returns to where it started.
 *
 * `start` must be the discrete page the gesture began on. Keeping the target
 * relative to it is what makes one gesture authoritative: a fast flick can
 * advance one page, never two, and an interrupted settle cannot shift the
 * baseline to a fractional page.
 */
/** Pages per second that turn a short drag into a one-page flick. */
export const SETTLE_FLICK_VELOCITY_PAGES = 1;

export const resolveSettleIntent = ({
  delta,
  velocityPages,
}: {
  /** Signed travel from the gesture's origin page, in pages. */
  delta: number;
  velocityPages: number;
}): number => {
  'worklet';
  if (delta >= 0.5) {
    return 1;
  }
  if (delta <= -0.5) {
    return -1;
  }
  const velocity = finite(velocityPages, 0);
  if (Math.abs(velocity) < SETTLE_FLICK_VELOCITY_PAGES) {
    return 0;
  }
  // A flick only advances when it does not contradict the drag itself.
  if (delta !== 0 && Math.sign(delta) !== Math.sign(velocity)) {
    return 0;
  }
  return velocity > 0 ? 1 : -1;
};

export const resolveSettleTarget = ({
  mode,
  position,
  range,
  start,
  velocityPages,
}: {
  mode: LinkedTrackSettleMode;
  position: number;
  range: TrackRange;
  /** Discrete page the current gesture started on. */
  start: number;
  /** Release velocity in pages per second. */
  velocityPages: number;
}): number => {
  'worklet';
  const resting = clampTrackPosition(position, range);
  if (mode === 'free') {
    return resting;
  }
  const origin = clampTrackPosition(Math.round(finite(start, 0)), range);
  const intent = resolveSettleIntent({
    delta: resting - origin,
    velocityPages,
  });
  return clampTrackPosition(origin + intent, range);
};

/** Nearest whole page, for bookkeeping (active tab / activity) only. */
export const resolveTrackPageIndex = (value: number, range: TrackRange) =>
  Math.round(clampTrackPosition(value, range));
