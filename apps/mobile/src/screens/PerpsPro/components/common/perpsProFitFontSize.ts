// Smaller sizes carry relatively wider tracking, so a purely linear scale
// would still overflow by a few points.
const FIT_SAFETY_RATIO = 0.95;
const FIT_FONT_SIZE_STEP = 0.5;

/**
 * Resolves the font size that fits a single-line text into the measured
 * space. `naturalWidth` is the unconstrained width at `baseFontSize` (see
 * `PerpsProTextWidthProbe`), so the result never feeds back into its own
 * measurement. Incomplete measurements keep the base size.
 */
export const resolvePerpsProFittedFontSize = ({
  availableWidth,
  baseFontSize,
  minFontSize,
  naturalWidth,
}: {
  availableWidth: number;
  baseFontSize: number;
  minFontSize: number;
  naturalWidth: number;
}): number => {
  if (
    !(availableWidth > 0) ||
    !(naturalWidth > 0) ||
    naturalWidth <= availableWidth
  ) {
    return baseFontSize;
  }
  const scaled =
    ((baseFontSize * availableWidth) / naturalWidth) * FIT_SAFETY_RATIO;
  const stepped = Math.floor(scaled / FIT_FONT_SIZE_STEP) * FIT_FONT_SIZE_STEP;
  return Math.max(minFontSize, Math.min(baseFontSize, stepped));
};
