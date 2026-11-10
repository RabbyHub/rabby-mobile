export const SCENE_PAGER_PREVIEW_ROW_LIMIT = 12;

export type ScenePagerPreviewWindowInput = {
  /** Exact row extents, including separators/margins; null means unmeasured. */
  rowHeights: readonly (number | null | undefined)[];
  /** Content coordinate of the first row (the preview's anchor). */
  rowStartOffset: number;
  sourceScrollOffset: number;
  viewportHeight: number;
  /** Target content padding; it participates in the target's native clamp. */
  paddingBottom?: number;
  /** Minimum total content height, including header and padding. */
  minContentHeight?: number;
  maxRows?: number;
};

export type ScenePagerPreviewWindow =
  | {
      status: 'resolved';
      startIndex: number;
      endIndexExclusive: number;
      /** Exact sum of all row extents preceding startIndex. */
      prefixOffset: number;
      targetScrollOffset: number;
      /** Offset from the row anchor, while the source list still owns scroll. */
      previewOffset: number;
      coverage: 'complete' | 'row-limit';
    }
  | {
      status: 'unresolved';
      reason:
        | 'invalid-geometry'
        | 'unknown-content-height'
        | 'unknown-row-height';
      rowIndex?: number;
    };

const isNonnegativeFinite = (value: number) =>
  Number.isFinite(value) && value >= 0;

/**
 * Pure, exact geometry for a bounded, non-scrolling neighbour preview.
 * Call when a gesture/window or measurement revision changes, not every frame:
 * building the contiguous measured prefix is O(n); no row data is materialized.
 * Measurements must belong to the same target/data/width/layout revision.
 *
 * This follows the current nonnegative Android offset model, not iOS bounce.
 * Given row anchor R, prefix P and clamped target offset Yt, positioning the
 * preview at R + P + (Y - Yt) yields the settled screen position R + P - Yt.
 * Unknown row extents are never filled using averages or later measurements.
 */
export function calculateScenePagerPreviewWindow({
  rowHeights,
  rowStartOffset,
  sourceScrollOffset,
  viewportHeight,
  paddingBottom = 0,
  minContentHeight = 0,
  maxRows = SCENE_PAGER_PREVIEW_ROW_LIMIT,
}: ScenePagerPreviewWindowInput): ScenePagerPreviewWindow {
  if (
    !isNonnegativeFinite(rowStartOffset) ||
    !Number.isFinite(sourceScrollOffset) ||
    !Number.isFinite(viewportHeight) ||
    viewportHeight <= 0 ||
    !isNonnegativeFinite(paddingBottom) ||
    !isNonnegativeFinite(minContentHeight) ||
    !Number.isInteger(maxRows) ||
    maxRows <= 0
  ) {
    return { status: 'unresolved', reason: 'invalid-geometry' };
  }

  const prefix = [0];
  for (let index = 0; index < rowHeights.length; index += 1) {
    const height = rowHeights[index];
    if (height == null) {
      break;
    }
    const next = prefix[index] + height;
    if (!isNonnegativeFinite(height) || !Number.isFinite(next)) {
      return {
        status: 'unresolved',
        reason: 'invalid-geometry',
        rowIndex: index,
      };
    }
    prefix.push(next);
  }

  const measuredCount = prefix.length - 1;
  const measuredHeight = prefix[measuredCount];
  const minimumKnownContentHeight = Math.max(
    minContentHeight,
    rowStartOffset + measuredHeight + paddingBottom,
  );
  if (!Number.isFinite(minimumKnownContentHeight)) {
    return { status: 'unresolved', reason: 'invalid-geometry' };
  }
  const sourceOffset = Math.max(sourceScrollOffset, 0);
  const minimumKnownMaxOffset = Math.max(
    minimumKnownContentHeight - viewportHeight,
    0,
  );
  const allMeasured = measuredCount === rowHeights.length;
  if (!allMeasured && sourceOffset > minimumKnownMaxOffset) {
    // The unseen tail could make this a clamped short target or a long one.
    return {
      status: 'unresolved',
      reason: 'unknown-content-height',
      rowIndex: measuredCount,
    };
  }
  const targetScrollOffset = allMeasured
    ? Math.min(sourceOffset, minimumKnownMaxOffset)
    : sourceOffset;
  const visibleStart = Math.max(targetScrollOffset - rowStartOffset, 0);
  const visibleEnd = Math.max(
    targetScrollOffset + viewportHeight - rowStartOffset,
    0,
  );
  const resolved = (
    startIndex: number,
    endIndexExclusive: number,
    coverage: 'complete' | 'row-limit' = 'complete',
  ): ScenePagerPreviewWindow => {
    const previewOffset =
      prefix[startIndex] + (sourceOffset - targetScrollOffset);
    return Number.isFinite(previewOffset)
      ? {
          status: 'resolved',
          startIndex,
          endIndexExclusive,
          prefixOffset: prefix[startIndex],
          targetScrollOffset,
          previewOffset,
          coverage,
        }
      : { status: 'unresolved', reason: 'invalid-geometry' };
  };
  if (visibleEnd === 0) {
    return resolved(0, 0);
  }

  // First row whose bottom exceeds the viewport start. Zero-height rows and
  // rows ending exactly on that boundary do not occupy the visible window.
  let startIndex = 0;
  let upper = measuredCount;
  while (startIndex < upper) {
    const middle = Math.floor((startIndex + upper) / 2);
    if (prefix[middle + 1] <= visibleStart) {
      startIndex = middle + 1;
    } else {
      upper = middle;
    }
  }
  let endIndexExclusive = startIndex;
  const rowLimit = Math.min(maxRows, SCENE_PAGER_PREVIEW_ROW_LIMIT);
  while (
    endIndexExclusive < measuredCount &&
    prefix[endIndexExclusive] < visibleEnd &&
    endIndexExclusive - startIndex < rowLimit
  ) {
    endIndexExclusive += 1;
  }
  if (
    endIndexExclusive - startIndex === rowLimit &&
    endIndexExclusive < rowHeights.length &&
    prefix[endIndexExclusive] < visibleEnd &&
    (!allMeasured || prefix[endIndexExclusive] < measuredHeight)
  ) {
    return resolved(startIndex, endIndexExclusive, 'row-limit');
  }
  if (!allMeasured && prefix[endIndexExclusive] < visibleEnd) {
    return {
      status: 'unresolved',
      reason: 'unknown-row-height',
      rowIndex: measuredCount,
    };
  }
  return resolved(startIndex, endIndexExclusive);
}
