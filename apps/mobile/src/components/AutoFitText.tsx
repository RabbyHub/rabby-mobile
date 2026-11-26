import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TextProps,
  TextStyle,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';

export type AutoFitTextProps = TextProps & {
  /**
   * Multi-language copy key. Preferred over `text` so the owning component can
   * tell English (the fixed design baseline) from a translated locale.
   */
  i18nKey?: string;
  /** Pre-resolved copy (tests / non-i18n call sites). */
  text?: string;
  style?: StyleProp<TextStyle>;
  /**
   * Layout width of the copy at the design font size, in points.
   *
   * - `singleLineWidth`: the copy on one unclamped line.
   * - `twoLineWidth`: the narrowest width at which the copy still fits in two
   *   lines, derived from the measured word widths (equal to
   *   `singleLineWidth` for one unbreakable word or when `numberOfLines` is 1).
   *
   * Measured from the platform's own layout (`onLayout`), which is the only
   * width that matches what the copy really occupies: `onTextLayout` reports a
   * line box rather than the glyph extent on iOS, and an absolutely positioned
   * Text with no explicit host width gets clamped to its parent on Android.
   */
  onMeasureTextWidth?: (measure: AutoFitTextMeasure) => void;
};

export type AutoFitTextMeasure = {
  singleLineWidth: number;
  twoLineWidth: number;
};

/** Wide enough for any badge copy on one line. */
const MEASURE_HOST_WIDTH = 4000;

/**
 * Copy that exposes its own layout width.
 *
 * English and translations render with the same caller style; the owning
 * container decides how wide the text may become, so typography stays at the
 * design size instead of shrinking.
 */
export const AutoFitText = ({
  style,
  i18nKey,
  text,
  numberOfLines = 2,
  onMeasureTextWidth,
  ...rest
}: AutoFitTextProps) => {
  const { t } = useTranslation();
  const copy = i18nKey ? t(i18nKey) : text ?? '';

  const flattenedStyle = React.useMemo(
    () => StyleSheet.flatten(style),
    [style],
  );
  const measureTextStyle = React.useMemo<TextStyle>(
    () => ({
      fontFamily: flattenedStyle?.fontFamily,
      fontStyle: flattenedStyle?.fontStyle,
      fontVariant: flattenedStyle?.fontVariant,
      fontWeight: flattenedStyle?.fontWeight,
      letterSpacing: flattenedStyle?.letterSpacing,
      textTransform: flattenedStyle?.textTransform,
      fontSize: flattenedStyle?.fontSize,
      lineHeight: flattenedStyle?.lineHeight,
    }),
    [flattenedStyle],
  );

  // One word per node so the two-line width can be computed exactly; copy
  // without whitespace (zh/ja/th) has nothing to split and stays one line.
  const measuredWords = React.useMemo(() => {
    if (numberOfLines <= 1) {
      return [];
    }
    const parts = copy.split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts : [];
  }, [copy, numberOfLines]);

  const [singleLineWidth, setSingleLineWidth] = React.useState(0);
  const [wordWidths, setWordWidths] = React.useState<Record<string, number>>(
    {},
  );

  const twoLineWidth = React.useMemo(() => {
    if (!singleLineWidth) {
      return 0;
    }
    if (!measuredWords.length) {
      return singleLineWidth;
    }

    const widths = measuredWords.map(
      (_, index) => wordWidths[`${copy}|${index}`],
    );
    if (widths.some(width => !width)) {
      return 0;
    }

    // Every gap in a whitespace-separated line has the same width.
    const gapCount = Math.max(1, measuredWords.length - 1);
    const sumOfWords = widths.reduce((total, width) => total + width, 0);
    const spaceWidth = Math.max(0, (singleLineWidth - sumOfWords) / gapCount);

    let best = Number.POSITIVE_INFINITY;
    for (let split = 1; split < measuredWords.length; split += 1) {
      const left =
        widths.slice(0, split).reduce((total, width) => total + width, 0) +
        (split - 1) * spaceWidth;
      const right =
        widths.slice(split).reduce((total, width) => total + width, 0) +
        (measuredWords.length - split - 1) * spaceWidth;
      best = Math.min(best, Math.max(left, right));
    }

    return Number.isFinite(best) ? best : singleLineWidth;
  }, [copy, measuredWords, singleLineWidth, wordWidths]);

  React.useEffect(() => {
    if (!onMeasureTextWidth || !singleLineWidth) {
      return;
    }
    onMeasureTextWidth({
      singleLineWidth,
      twoLineWidth: twoLineWidth || singleLineWidth,
    });
  }, [onMeasureTextWidth, singleLineWidth, twoLineWidth]);

  return (
    <>
      <Text
        {...rest}
        numberOfLines={numberOfLines}
        onTextLayout={undefined}
        style={style}>
        {copy}
      </Text>
      {/* Off-flow measurement. The host owns a very wide box and lays its
          children out as a row, so each child reports its intrinsic width
          instead of stretching to the host. */}
      <View style={styles.measureHost} pointerEvents="none">
        <Text
          numberOfLines={1}
          onLayout={event =>
            setSingleLineWidth(event.nativeEvent.layout.width || 0)
          }
          style={measureTextStyle}>
          {copy}
        </Text>
        {measuredWords.map((word, index) => (
          <Text
            key={`measure-word-${index}`}
            numberOfLines={1}
            onLayout={event => {
              const width = event.nativeEvent.layout.width || 0;
              setWordWidths(prev =>
                prev[`${copy}|${index}`] === width
                  ? prev
                  : { ...prev, [`${copy}|${index}`]: width },
              );
            }}
            style={measureTextStyle}>
            {word}
          </Text>
        ))}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  measureHost: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MEASURE_HOST_WIDTH,
    flexDirection: 'row',
    alignItems: 'flex-start',
    opacity: 0,
    zIndex: -1,
  },
});
