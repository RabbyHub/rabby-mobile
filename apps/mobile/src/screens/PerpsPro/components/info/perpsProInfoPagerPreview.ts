const PREVIEW_ENTER_THRESHOLD = 0.55;
const PREVIEW_EXIT_THRESHOLD = 0.45;

export const getPerpsProInfoPagerPreviewPosition = ({
  maximumPosition,
  pagePosition,
  previewPosition,
  settledPosition,
}: {
  maximumPosition: number;
  pagePosition: number;
  previewPosition: number;
  settledPosition: number;
}) => {
  'worklet';
  const safeMaximum = Number.isFinite(maximumPosition)
    ? Math.max(0, Math.floor(maximumPosition))
    : 0;
  const safeSettled = Number.isFinite(settledPosition)
    ? Math.min(Math.max(Math.round(settledPosition), 0), safeMaximum)
    : 0;
  const safePreview = Number.isFinite(previewPosition)
    ? Math.min(Math.max(Math.round(previewPosition), 0), safeMaximum)
    : safeSettled;
  const safePagePosition = Number.isFinite(pagePosition)
    ? Math.min(Math.max(pagePosition, 0), safeMaximum)
    : safeSettled;
  const progressFromSettled = safePagePosition - safeSettled;

  if (safePreview === safeSettled) {
    if (progressFromSettled >= PREVIEW_ENTER_THRESHOLD) {
      return Math.min(safeSettled + 1, safeMaximum);
    }
    if (progressFromSettled <= -PREVIEW_ENTER_THRESHOLD) {
      return Math.max(safeSettled - 1, 0);
    }
    return safeSettled;
  }

  const previewDirection = Math.sign(safePreview - safeSettled);
  const progressTowardPreview = progressFromSettled * previewDirection;
  return progressTowardPreview <= PREVIEW_EXIT_THRESHOLD
    ? safeSettled
    : safePreview;
};
