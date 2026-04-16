export const ellipsisOverflowedText = (
  str?: string,
  length = 5,
  removeLastComma = false,
) => {
  if (!str) return '';
  if (str.length <= length) return str;
  let cut = str.substring(0, length);
  if (removeLastComma) {
    if (cut.endsWith(',')) {
      cut = cut.substring(0, length - 1);
    }
  }
  return `${cut}...`;
};
