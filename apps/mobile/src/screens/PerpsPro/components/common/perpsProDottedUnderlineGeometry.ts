export const PERPS_PRO_DOTTED_UNDERLINE_DEFAULT_FONT_SIZE = 12;

const PERPS_PRO_DOTTED_UNDERLINE_THICKNESS_RATIO = 0.1;
const PERPS_PRO_DOTTED_UNDERLINE_OFFSET_RATIO = 0.25;

export type PerpsProDottedUnderlineLineMetrics = Readonly<{
  ascender: number;
  baseline?: number;
  width: number;
  y: number;
}>;

export type PerpsProDottedUnderlineGeometry = Readonly<{
  canvasHeight: number;
  canvasTop: number;
  dotGap: number;
  dotLength: number;
  lineX1: number;
  lineX2: number;
  lineY: number;
  strokeWidth: number;
  width: number;
}>;

type ResolvePerpsProDottedUnderlineGeometryInput = Readonly<{
  fontSize: number;
  line: PerpsProDottedUnderlineLineMetrics;
  minimumStrokeWidth: number;
  roundToNearestPixel: (value: number) => number;
}>;

const finitePositiveOr = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

export const resolvePerpsProDottedUnderlineGeometry = ({
  fontSize,
  line,
  minimumStrokeWidth,
  roundToNearestPixel,
}: ResolvePerpsProDottedUnderlineGeometryInput): PerpsProDottedUnderlineGeometry => {
  const resolvedFontSize = finitePositiveOr(
    fontSize,
    PERPS_PRO_DOTTED_UNDERLINE_DEFAULT_FONT_SIZE,
  );
  const strokeWidth = Math.max(
    finitePositiveOr(minimumStrokeWidth, 1),
    roundToNearestPixel(
      resolvedFontSize * PERPS_PRO_DOTTED_UNDERLINE_THICKNESS_RATIO,
    ),
  );
  const offset = roundToNearestPixel(
    resolvedFontSize * PERPS_PRO_DOTTED_UNDERLINE_OFFSET_RATIO,
  );
  const fallbackBaseline = line.y + line.ascender;
  const baseline =
    typeof line.baseline === 'number' && Number.isFinite(line.baseline)
      ? line.baseline
      : Number.isFinite(fallbackBaseline)
      ? fallbackBaseline
      : 0;
  const width = Number.isFinite(line.width) ? Math.max(line.width, 0) : 0;
  const lineInset = Math.min(strokeWidth / 2, width / 2);

  return {
    canvasHeight: strokeWidth,
    canvasTop: roundToNearestPixel(baseline + offset - strokeWidth / 2),
    dotGap: strokeWidth * 2,
    dotLength: strokeWidth,
    lineX1: lineInset,
    lineX2: Math.max(width - lineInset, lineInset),
    lineY: strokeWidth / 2,
    strokeWidth,
    width,
  };
};

export const arePerpsProDottedUnderlineGeometriesEqual = (
  current: PerpsProDottedUnderlineGeometry | null,
  next: PerpsProDottedUnderlineGeometry | null,
  tolerance: number,
) => {
  if (current === next) {
    return true;
  }
  if (!current || !next) {
    return false;
  }
  return (
    Math.abs(current.canvasHeight - next.canvasHeight) < tolerance &&
    Math.abs(current.canvasTop - next.canvasTop) < tolerance &&
    Math.abs(current.dotGap - next.dotGap) < tolerance &&
    Math.abs(current.dotLength - next.dotLength) < tolerance &&
    Math.abs(current.lineX1 - next.lineX1) < tolerance &&
    Math.abs(current.lineX2 - next.lineX2) < tolerance &&
    Math.abs(current.lineY - next.lineY) < tolerance &&
    Math.abs(current.strokeWidth - next.strokeWidth) < tolerance &&
    Math.abs(current.width - next.width) < tolerance
  );
};
