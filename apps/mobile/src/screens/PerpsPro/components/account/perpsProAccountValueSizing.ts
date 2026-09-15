import { getFittingFontSize } from '@/components/AutoShrinkAmountTextSizing';

export const ACCOUNT_VALUE_FONT_SIZE = 18;
export const ACCOUNT_VALUE_LINE_HEIGHT = 22;

// A native rendering bound, not a readability cutoff that permits truncation.
const MIN_FONT_SIZE = 1;

export type AccountValueWidths = Readonly<Partial<Record<number, number>>>;

/** Resolve the largest verified integer size; measure only the missing candidate. */
export function resolveAccountValueFit(
  availableWidth: number,
  widths: AccountValueWidths,
  pixelRatio: number,
) {
  const baseWidth = widths[ACCOUNT_VALUE_FONT_SIZE];
  const availablePixels = Math.floor(availableWidth * pixelRatio);
  if (!baseWidth || availablePixels <= 0) {
    return {
      fontSize: ACCOUNT_VALUE_FONT_SIZE,
      measureFontSize: ACCOUNT_VALUE_FONT_SIZE,
      ready: false,
    };
  }

  let largestFit = 0;
  let smallestOverflow = ACCOUNT_VALUE_FONT_SIZE + 1;
  for (const [size, width] of Object.entries(widths)) {
    if (width == null) {
      continue;
    }
    const fontSize = Number(size);
    if (Math.ceil(width * pixelRatio) <= availablePixels) {
      largestFit = Math.max(largestFit, fontSize);
    } else {
      smallestOverflow = Math.min(smallestOverflow, fontSize);
    }
  }

  if (largestFit > 0 && smallestOverflow === largestFit + 1) {
    return { fontSize: largestFit, measureFontSize: null, ready: true };
  }
  if (smallestOverflow === MIN_FONT_SIZE) {
    // A zero/tiny transient layout must not publish a clipped amount as fitted.
    return { fontSize: MIN_FONT_SIZE, measureFontSize: null, ready: false };
  }

  const estimate = getFittingFontSize({
    availableWidth: availablePixels / pixelRatio,
    textWidthAtBaseFontSize: baseWidth,
    baseFontSize: ACCOUNT_VALUE_FONT_SIZE,
    minFontSize: MIN_FONT_SIZE,
    fontSizeStep: 1,
  });
  const candidate = Math.max(
    largestFit + 1,
    Math.min(smallestOverflow - 1, estimate),
  );
  return {
    fontSize: largestFit || candidate,
    measureFontSize: candidate,
    ready: false,
  };
}
