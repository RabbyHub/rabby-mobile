export const getRequiredTickerColumnCount = (
  text: string,
  maxLength: number,
) => {
  'worklet';

  return Math.min(maxLength, Math.max(1, text.length));
};

export const getFittedTickerFontSize = (
  fontSize: number,
  widthUnits: number,
  availableWidth: number,
) => {
  'worklet';

  if (
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0 ||
    widthUnits <= 0
  ) {
    return fontSize;
  }
  return Math.min(fontSize, availableWidth / widthUnits);
};
