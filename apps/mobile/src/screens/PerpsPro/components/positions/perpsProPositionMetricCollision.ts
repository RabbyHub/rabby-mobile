export type PerpsProPositionMetricCollisionMeasurements = Readonly<{
  middleFirstLineWidth: number;
  middleFirstLineX: number;
  rightNaturalWidth: number;
  rightWrapped: boolean;
  rowWidth: number;
  secondColumnX: number;
}>;

const isFiniteNonNegative = (value: number) =>
  Number.isFinite(value) && value >= 0;

/**
 * Resolves the actual compact-layout geometry instead of guessing from a
 * locale, translation key, or character count. `null` means native layout has
 * not supplied a complete, trustworthy measurement yet.
 */
export const resolvePerpsProPositionMetricCollision = (
  measurements: Partial<PerpsProPositionMetricCollisionMeasurements>,
  columnGap: number,
): boolean | null => {
  const {
    middleFirstLineWidth,
    middleFirstLineX,
    rightNaturalWidth,
    rightWrapped,
    rowWidth,
    secondColumnX,
  } = measurements;

  // A bounded multiline label proves that compact mode cannot preserve its
  // current one-line geometry. No estimate of the unbounded string is needed.
  if (rightWrapped === true) {
    return true;
  }

  if (
    middleFirstLineWidth == null ||
    middleFirstLineX == null ||
    rightNaturalWidth == null ||
    rowWidth == null ||
    secondColumnX == null ||
    !isFiniteNonNegative(middleFirstLineWidth) ||
    !isFiniteNonNegative(middleFirstLineX) ||
    !isFiniteNonNegative(rightNaturalWidth) ||
    !isFiniteNonNegative(rowWidth) ||
    !isFiniteNonNegative(secondColumnX) ||
    !isFiniteNonNegative(columnGap) ||
    rowWidth === 0
  ) {
    return null;
  }

  const middleRight = secondColumnX + middleFirstLineX + middleFirstLineWidth;
  const rightLeft = rowWidth - rightNaturalWidth;

  return rightLeft < middleRight + columnGap;
};
