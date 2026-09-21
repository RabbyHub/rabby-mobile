type GetFontSizeByLengthOptions = {
  maxFontSize: number;
  minFontSize: number;
  threshold: number;
  step?: number;
};

export const getFontSizeByLength = (
  length: number,
  options: GetFontSizeByLengthOptions,
) => {
  'worklet';

  const { maxFontSize, minFontSize, threshold, step = 2 } = options;

  if (length <= threshold) {
    return maxFontSize;
  }

  if (step <= 0) {
    return minFontSize;
  }

  const reducedFontSize = maxFontSize - (length - threshold) * step;

  return Math.max(minFontSize, reducedFontSize);
};
