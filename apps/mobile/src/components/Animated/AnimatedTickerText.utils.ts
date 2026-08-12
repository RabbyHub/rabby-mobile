export const getRequiredTickerColumnCount = (
  text: string,
  maxLength: number,
) => {
  'worklet';

  return Math.min(maxLength, Math.max(1, text.length));
};
