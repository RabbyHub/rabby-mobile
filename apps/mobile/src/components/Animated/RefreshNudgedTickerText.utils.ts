export const nudgeLastVisibleDigitText = (text: string, maxLength: number) => {
  'worklet';

  const visibleLength = Math.min(text.length, maxLength);
  for (let i = visibleLength - 1; i >= 0; i -= 1) {
    const code = text.charCodeAt(i);

    // ASCII digit range: '0' (48) through '9' (57).
    if (code >= 48 && code <= 57) {
      const digit = code - 48;
      const nextDigit = digit <= 3 ? digit + 1 : digit - 1;

      return `${text.slice(0, i)}${nextDigit}${text.slice(i + 1)}`;
    }
  }

  return text;
};

const getVisibleNumericValue = (text: string, maxLength: number) => {
  'worklet';

  const visibleLength = Math.min(text.length, maxLength);
  let numericText = '';
  let hasDigit = false;
  let hasDecimalPoint = false;

  for (let i = 0; i < visibleLength; i += 1) {
    const code = text.charCodeAt(i);

    // ASCII digit range: '0' (48) through '9' (57).
    if (code >= 48 && code <= 57) {
      numericText += text[i];
      hasDigit = true;
      continue;
    }

    if (code === 44) {
      continue;
    }

    if (code === 46 && !hasDecimalPoint) {
      numericText += '.';
      hasDecimalPoint = true;
    }
  }

  if (!hasDigit) {
    return 0;
  }

  const numericValue = Number(numericText);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return numericValue;
};

export const shouldNudgeRefreshText = (
  beforeText: string,
  afterText: string,
  maxLength: number,
) => {
  'worklet';

  return (
    !!beforeText &&
    beforeText === afterText &&
    getVisibleNumericValue(beforeText, maxLength) > 10
  );
};
