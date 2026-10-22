type PagerDragInput = {
  startIndex: number;
  translationX: number;
  width: number;
  pageCount: number;
};

const getPageCount = (pageCount: number) => {
  'worklet';

  return Number.isFinite(pageCount) ? Math.max(0, Math.floor(pageCount)) : 0;
};

const clamp = (value: number, min: number, max: number) => {
  'worklet';

  return Math.min(Math.max(value, min), max);
};

const getStartIndex = (startIndex: number, pageCount: number) => {
  'worklet';

  return pageCount > 0 && Number.isFinite(startIndex)
    ? clamp(Math.round(startIndex), 0, pageCount - 1)
    : 0;
};

// Resolve at most one adjacent page from the gesture's settled start.
export const resolvePagerTarget = ({
  startIndex,
  translationX,
  velocityX,
  width,
  pageCount,
}: PagerDragInput & { velocityX: number }): number => {
  'worklet';

  const count = getPageCount(pageCount);
  const start = getStartIndex(startIndex, count);
  if (
    count <= 1 ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(translationX)
  ) {
    return start;
  }

  const distance = Math.abs(translationX);
  const isFling =
    distance >= 12 && Number.isFinite(velocityX) && Math.abs(velocityX) >= 600;
  // A meaningful reversal follows the final fling, not its old net drag.
  const directionX = isFling ? velocityX : translationX;
  if (!isFling && distance < width * 0.25) {
    return start;
  }
  return clamp(start + (directionX < 0 ? 1 : -1), 0, count - 1);
};

// Report an outward pull only when the gesture began at that boundary.
export const resolvePagerBoundary = ({
  startIndex,
  translationX,
  pageCount,
}: Omit<PagerDragInput, 'width'>): 'prev' | 'next' | null => {
  'worklet';

  const count = getPageCount(pageCount);
  if (!count || !Number.isFinite(translationX)) {
    return null;
  }
  const start = getStartIndex(startIndex, count);
  if (start === 0 && translationX >= 60) {
    return 'prev';
  }
  if (start === count - 1 && translationX <= -60) {
    return 'next';
  }
  return null;
};

// Follow the finger within the start page's two immediate neighbours.
export const getPagerDragPosition = ({
  startIndex,
  translationX,
  width,
  pageCount,
}: PagerDragInput): number => {
  'worklet';

  const count = getPageCount(pageCount);
  const start = getStartIndex(startIndex, count);
  if (
    count <= 1 ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(translationX)
  ) {
    return start;
  }
  return clamp(
    start - translationX / width,
    Math.max(0, start - 1),
    Math.min(count - 1, start + 1),
  );
};
