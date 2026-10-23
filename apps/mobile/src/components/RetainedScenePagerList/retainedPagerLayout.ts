/** Geometry for native-measured retained pages (or exact test fixtures).
 * These functions do not estimate business row heights, operate a ScrollView,
 * or prove that React/native layout updates become visible atomically.
 */
export type RetainedPagerLayoutInput = {
  pageHeights: readonly number[];
  /** Keep the source index until a transition ends, including cancellation. */
  settledIndex: number;
  viewportHeight: number;
  /** Full content preceding the pager, including its tab strip. */
  headerHeight: number;
  tabHeight: number;
  /** null means idle; capture together with transitionPagerHeight at drag start. */
  transitionScrollY: number | null;
  /** Exact source pager height captured at the same instant as scrollY.
   * Viewport/layout invalidation should cancel a transition at its owner.
   */
  transitionPagerHeight?: number;
};

export type RetainedPagerLayout = {
  pagerHeight: number;
  pageTopInsets: number[];
};

export type RetainedPagerScrollInput = Pick<
  RetainedPagerLayoutInput,
  'viewportHeight' | 'headerHeight' | 'tabHeight'
> & {
  scrollY: number;
  pageHeight: number;
};

const nonnegativeFinite = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const getMinimumPageHeight = (viewportHeight: number, tabHeight: number) =>
  Math.max(0, nonnegativeFinite(viewportHeight) - nonnegativeFinite(tabHeight));

/** Expected idle native clamp, for geometry/observation only. The owner must
 * let native content-size shrink perform the actual clamp, not scrollTo here.
 */
export function clampRetainedPagerScrollY({
  scrollY,
  pageHeight,
  viewportHeight,
  headerHeight,
  tabHeight,
}: RetainedPagerScrollInput): number {
  const minimumPageHeight = getMinimumPageHeight(viewportHeight, tabHeight);
  const maxOffset = Math.min(
    Number.MAX_VALUE,
    Math.max(
      0,
      nonnegativeFinite(headerHeight) -
        nonnegativeFinite(viewportHeight) +
        Math.max(nonnegativeFinite(pageHeight), minimumPageHeight),
    ),
  );
  return Math.min(nonnegativeFinite(scrollY), maxOffset);
}

/** Retain the source pager's viewport while dragging; neighbouring page
 * contents retain their own full heights and may overflow that viewport.
 * Insets align short neighbours to their eventual native-clamped offset.
 * They are layout padding, not a second vertical scroll or transform owner.
 */
export function resolveRetainedPagerLayout({
  pageHeights,
  settledIndex,
  viewportHeight,
  headerHeight,
  tabHeight,
  transitionScrollY,
  transitionPagerHeight,
}: RetainedPagerLayoutInput): RetainedPagerLayout {
  const minimumPageHeight = getMinimumPageHeight(viewportHeight, tabHeight);
  const sourceIndex = Math.min(
    Math.max(0, pageHeights.length - 1),
    Math.max(0, Number.isFinite(settledIndex) ? Math.trunc(settledIndex) : 0),
  );
  const idleHeight = Math.max(
    nonnegativeFinite(pageHeights[sourceIndex] ?? 0),
    minimumPageHeight,
  );
  if (transitionScrollY === null) {
    return {
      pagerHeight: idleHeight,
      pageTopInsets: pageHeights.map(() => 0),
    };
  }

  const capturedScrollY = nonnegativeFinite(transitionScrollY);
  const hasCapturedHeight =
    transitionPagerHeight !== undefined &&
    Number.isFinite(transitionPagerHeight) &&
    transitionPagerHeight >= 0;
  return {
    // An explicit snapshot is required to hold height across a live source
    // update; without one, derive height from the current source geometry.
    pagerHeight: hasCapturedHeight ? transitionPagerHeight : idleHeight,
    pageTopInsets: pageHeights.map((pageHeight, index) =>
      index === sourceIndex
        ? 0
        : capturedScrollY -
          clampRetainedPagerScrollY({
            scrollY: capturedScrollY,
            pageHeight,
            viewportHeight,
            headerHeight,
            tabHeight,
          }),
    ),
  };
}
