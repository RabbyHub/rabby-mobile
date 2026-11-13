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
 * - `snap`: nearest page, biased by the release velocity so a flick advances
 *   even when the finger stopped short of half a page.
 */
export const resolveSettleTarget = ({
  mode,
  position,
  range,
  velocityPages,
}: {
  mode: LinkedTrackSettleMode;
  position: number;
  range: TrackRange;
  /** Release velocity in pages per second. */
  velocityPages: number;
}): number => {
  'worklet';
  const resting = clampTrackPosition(position, range);
  if (mode === 'free') {
    return resting;
  }
  const projected = resting + finite(velocityPages, 0) * 0.18;
  return clampTrackPosition(Math.round(projected), range);
};

/** Nearest whole page, for bookkeeping (active tab / activity) only. */
export const resolveTrackPageIndex = (value: number, range: TrackRange) =>
  Math.round(clampTrackPosition(value, range));
