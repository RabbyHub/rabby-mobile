import { resolvePagerTarget } from './pagerMath';

export type LinkedPagerRowBounds = { startOffset: number; endOffset: number };
export type LinkedPagerViewport = { offset: number; height: number };

/** Exact content coordinates only. Unknown geometry keeps the row participating. */
export const isLinkedPagerRowInViewport = (
  bounds: LinkedPagerRowBounds | undefined,
  viewport: LinkedPagerViewport,
  overscan: number,
): boolean => {
  'worklet';
  if (
    !bounds ||
    !Number.isFinite(bounds.startOffset) ||
    !Number.isFinite(bounds.endOffset) ||
    bounds.startOffset < 0 ||
    bounds.endOffset <= bounds.startOffset ||
    !Number.isFinite(viewport.offset) ||
    viewport.offset < 0 ||
    !Number.isFinite(viewport.height) ||
    viewport.height <= 0 ||
    !Number.isFinite(overscan) ||
    overscan < 0
  ) {
    return true;
  }
  return (
    bounds.endOffset >= viewport.offset - overscan &&
    bounds.startOffset <= viewport.offset + viewport.height + overscan
  );
};

export type LinkedPagerTrack = {
  key: string;
  keys: readonly string[];
  activeKey: string;
  parentKey?: string;
  parentPageKey?: string;
  startOffset: number;
};

export type LinkedPagerOwner = {
  ownerKey: string;
  /** The owner's settled page index, not its index in the tracks array. */
  ownerIndex: number;
  targetIndex: number;
};

export type LinkedPagerOwnerInput = {
  tracks: readonly LinkedPagerTrack[];
  /** Content coordinate captured at gesture start; do not re-hit-test on scroll. */
  contentY: number;
  translationX: number;
  velocityX?: number;
  width: number;
};

const findUniqueTrackIndex = (
  tracks: readonly LinkedPagerTrack[],
  key: string,
): number => {
  'worklet';

  let result = -1;
  for (let index = 0; index < tracks.length; index++) {
    if (tracks[index].key === key) {
      if (result !== -1) {
        return -1;
      }
      result = index;
    }
  }
  return result;
};

const getEligibleDepth = (
  tracks: readonly LinkedPagerTrack[],
  trackIndex: number,
  contentY: number,
): number => {
  'worklet';

  let currentIndex = trackIndex;
  // A valid ancestry reaches a root within tracks.length visits. This also
  // rejects cycles without recursion or mutating the supplied hierarchy.
  for (let depth = 0; depth < tracks.length; depth++) {
    const track = tracks[currentIndex];
    if (
      !track.key ||
      findUniqueTrackIndex(tracks, track.key) !== currentIndex ||
      !Number.isFinite(track.startOffset) ||
      contentY < track.startOffset ||
      !track.keys.length ||
      track.keys.indexOf(track.activeKey) === -1
    ) {
      return -1;
    }
    for (let index = 0; index < track.keys.length; index++) {
      if (
        !track.keys[index] ||
        track.keys.indexOf(track.keys[index]) !== index
      ) {
        return -1;
      }
    }

    if (track.parentKey === undefined && track.parentPageKey === undefined) {
      return depth;
    }
    if (track.parentKey === undefined || track.parentPageKey === undefined) {
      return -1;
    }
    const parentIndex = findUniqueTrackIndex(tracks, track.parentKey);
    if (
      parentIndex === -1 ||
      tracks[parentIndex].activeKey !== track.parentPageKey
    ) {
      return -1;
    }
    currentIndex = parentIndex;
  }
  return -1;
};

/**
 * Resolve the deepest active track at the gesture's starting content position,
 * handing an outward drag to its first movable ancestor during that gesture.
 * Omit velocity while dragging; pass release velocity to resolve a final fling.
 * All tracks use the same viewport width and only the returned owner may move.
 */
export const resolveLinkedPagerOwner = ({
  tracks,
  contentY,
  translationX,
  velocityX = 0,
  width,
}: LinkedPagerOwnerInput): LinkedPagerOwner | null => {
  'worklet';

  if (
    !Number.isFinite(contentY) ||
    !Number.isFinite(translationX) ||
    translationX === 0 ||
    !Number.isFinite(width) ||
    width <= 0
  ) {
    return null;
  }

  let selectedIndex = -1;
  let selectedDepth = -1;
  let selectedOffset = -Infinity;
  let ambiguous = false;
  for (let index = 0; index < tracks.length; index++) {
    const depth = getEligibleDepth(tracks, index, contentY);
    if (depth === -1) {
      continue;
    }
    const offset = tracks[index].startOffset;
    if (
      depth > selectedDepth ||
      (depth === selectedDepth && offset > selectedOffset)
    ) {
      selectedIndex = index;
      selectedDepth = depth;
      selectedOffset = offset;
      ambiguous = false;
    } else if (depth === selectedDepth && offset === selectedOffset) {
      ambiguous = true;
    }
  }
  if (selectedIndex === -1 || ambiguous) {
    return null;
  }

  // Match resolvePagerTarget's meaningful fling rule, including reversals.
  // Ownership must transfer before the distance threshold, so a short drag
  // can move its parent's track and still settle back without committing.
  const isFling =
    Math.abs(translationX) >= 12 &&
    Number.isFinite(velocityX) &&
    Math.abs(velocityX) >= 600;
  const direction = (isFling ? velocityX : translationX) < 0 ? 1 : -1;
  for (let visited = 0; visited < tracks.length; visited++) {
    const owner = tracks[selectedIndex];
    const ownerIndex = owner.keys.indexOf(owner.activeKey);
    const adjacentIndex = ownerIndex + direction;
    if (
      (adjacentIndex >= 0 && adjacentIndex < owner.keys.length) ||
      owner.parentKey === undefined
    ) {
      return {
        ownerKey: owner.key,
        ownerIndex,
        targetIndex: resolvePagerTarget({
          startIndex: ownerIndex,
          pageCount: owner.keys.length,
          translationX,
          velocityX,
          width,
        }),
      };
    }
    selectedIndex = findUniqueTrackIndex(tracks, owner.parentKey);
    if (selectedIndex === -1) {
      return null;
    }
  }
  return null;
};
