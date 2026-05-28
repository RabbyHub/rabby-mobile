import { useMemo, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  TextLayoutEventData,
  TextStyle,
} from 'react-native';

export const DEFAULT_MAX_FONT_SIZE = 28;
export const DEFAULT_MIN_FONT_SIZE = 18;
export const DEFAULT_FONT_SIZE_STEP = 2;

export function getMeasureTextStyle(style?: TextStyle): TextStyle {
  if (!style) {
    return {};
  }

  return {
    fontFamily: style.fontFamily,
    fontStyle: style.fontStyle,
    fontVariant: style.fontVariant,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
  };
}

export function getFittingFontSize({
  availableWidth,
  textWidthAtBaseFontSize,
  baseFontSize,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
  fontSizeStep = DEFAULT_FONT_SIZE_STEP,
}: {
  availableWidth: number;
  textWidthAtBaseFontSize: number;
  baseFontSize: number;
  minFontSize?: number;
  fontSizeStep?: number;
}) {
  if (!availableWidth || !textWidthAtBaseFontSize) {
    return baseFontSize;
  }

  for (
    let fontSize = baseFontSize;
    fontSize >= minFontSize;
    fontSize -= fontSizeStep
  ) {
    if ((textWidthAtBaseFontSize * fontSize) / baseFontSize <= availableWidth) {
      return fontSize;
    }
  }

  return minFontSize;
}

export function useFittingFontSize({
  style,
  maxFontSize,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
  fontSizeStep = DEFAULT_FONT_SIZE_STEP,
}: {
  style?: StyleProp<TextStyle>;
  maxFontSize?: number;
  minFontSize?: number;
  fontSizeStep?: number;
}) {
  const flattenedStyle = useMemo(() => StyleSheet.flatten(style), [style]);
  const measureTextStyle = useMemo(
    () => getMeasureTextStyle(flattenedStyle),
    [flattenedStyle],
  );
  const baseFontSize =
    maxFontSize || Number(flattenedStyle?.fontSize) || DEFAULT_MAX_FONT_SIZE;
  const [inputWidth, setInputWidth] = useState(0);
  const [textWidthAtBaseFontSize, setTextWidthAtBaseFontSize] = useState(0);

  const fittingFontSize = useMemo(
    () =>
      getFittingFontSize({
        availableWidth: inputWidth,
        textWidthAtBaseFontSize,
        baseFontSize,
        minFontSize,
        fontSizeStep,
      }),
    [
      baseFontSize,
      fontSizeStep,
      inputWidth,
      minFontSize,
      textWidthAtBaseFontSize,
    ],
  );

  const handleMeasureTextLayout = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    setTextWidthAtBaseFontSize(event.nativeEvent.lines[0]?.width || 0);
  };

  return {
    baseFontSize,
    fittingFontSize,
    measureTextStyle,
    setInputWidth,
    handleMeasureTextLayout,
  };
}
