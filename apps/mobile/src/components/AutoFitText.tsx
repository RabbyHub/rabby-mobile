import React from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  TextProps,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import {
  getFittingFontSize,
  getMeasureTextStyle,
} from './AutoShrinkAmountTextSizing';

export type AutoFitTextProps = TextProps & {
  /**
   * Multi-language copy key. Preferred over `text`: it lets the component
   * decide whether the fixed English baseline or the adaptive path applies.
   */
  i18nKey?: string;
  /** Pre-resolved copy (tests / non-i18n call sites). */
  text?: string;
  style?: StyleProp<TextStyle>;
  /** Design font size. The text never grows above it. */
  baseFontSize: number;
  /** Smallest size the text may shrink to. */
  minFontSize: number;
  /** Android-only shrink step, in points (default 1). */
  fontSizeStep?: number;
  /**
   * Force the adaptive path even when the active language is English.
   * Off by default: English must keep the fixed design metrics.
   */
  forceAutoFit?: boolean;
};

/**
 * Pure Text that keeps a single line of copy inside the width it is given.
 *
 * ## Language gate (deliberate)
 *
 * English is the production/design baseline: the screens are built, reviewed
 * and compared against the online build in English, so its typography must be
 * deterministic and must not depend on a measuring pass, device font metrics
 * or the width of the slot it happens to get. When the copy comes from a
 * multi-language key (`i18nKey`) and the active language is English, the
 * adaptive behaviour is therefore switched **off**: all styles stay fixed and
 * no measurement runs. Pass `forceAutoFit` only for a deliberate exception
 * (tests or a playground) — never for a production English screen.
 *
 * Other languages opt into auto-fit so their longer translations shrink to
 * fit instead of wrapping or being clipped.
 *
 * ## Cross-platform implementation
 *
 * - iOS: the native `adjustsFontSizeToFit` + `minimumFontScale` pair shrinks
 *   the text inside CoreText, so there is no JS measuring pass or reflow.
 * - Android: `adjustsFontSizeToFit` is ignored by the platform, so the same
 *   result is reproduced by measuring the unclamped text once
 *   (`onTextLayout`) and stepping the font size down until it fits.
 *
 * English renders at `baseFontSize` with the caller's style untouched; longer
 * translations shrink instead of wrapping or being clipped.
 */
export const AutoFitText = ({
  style,
  i18nKey,
  text,
  baseFontSize,
  minFontSize,
  fontSizeStep = 1,
  numberOfLines = 1,
  forceAutoFit = false,
  ...rest
}: AutoFitTextProps) => {
  const { t, i18n } = useTranslation();
  const activeLanguage = i18n?.resolvedLanguage || i18n?.language || '';
  const isEnglish = /^en(-|$)/i.test(activeLanguage);
  const copy = i18nKey ? t(i18nKey) : text ?? '';
  const autoFit = forceAutoFit || !isEnglish;

  const flattenedStyle = React.useMemo(
    () => StyleSheet.flatten(style),
    [style],
  );
  const measureTextStyle = React.useMemo(
    () => getMeasureTextStyle(flattenedStyle),
    [flattenedStyle],
  );
  const textForMeasure = React.useMemo(() => copy, [copy]);

  const isIOS = Platform.OS === 'ios';
  const [availableWidth, setAvailableWidth] = React.useState(0);
  const [textWidthAtBaseFontSize, setTextWidthAtBaseFontSize] =
    React.useState(0);

  const androidFontSize = React.useMemo(
    () =>
      autoFit
        ? getFittingFontSize({
            // A multi-line target has `numberOfLines` times the width to
            // work with, so the measurement only forces a smaller font when
            // even that many lines cannot hold the copy.
            availableWidth: availableWidth * numberOfLines,
            textWidthAtBaseFontSize,
            baseFontSize,
            minFontSize,
            fontSizeStep,
          })
        : baseFontSize,
    [
      autoFit,
      availableWidth,
      baseFontSize,
      fontSizeStep,
      minFontSize,
      numberOfLines,
      textWidthAtBaseFontSize,
    ],
  );

  // English: fixed design metrics, no measurement, no dynamic font size.
  if (!autoFit) {
    return (
      <Text
        {...rest}
        numberOfLines={numberOfLines}
        style={[style, { fontSize: baseFontSize }]}>
        {copy}
      </Text>
    );
  }

  return (
    <>
      <Text
        {...rest}
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={isIOS}
        minimumFontScale={Math.max(0.1, minFontSize / baseFontSize)}
        onLayout={
          isIOS
            ? undefined
            : event => setAvailableWidth(event.nativeEvent.layout.width)
        }
        // Android-only: keep the platform from applying its advanced line
        // breaker while we are still measuring (it can fold a word to the next
        // line before the width fits it).
        textBreakStrategy={isIOS ? undefined : 'simple'}
        style={[style, { fontSize: isIOS ? baseFontSize : androidFontSize }]}>
        {copy}
      </Text>
      {isIOS ? null : (
        <Text
          numberOfLines={1}
          onTextLayout={event =>
            setTextWidthAtBaseFontSize(event.nativeEvent.lines[0]?.width || 0)
          }
          style={[
            measureTextStyle,
            styles.measure,
            { fontSize: baseFontSize },
          ]}>
          {textForMeasure}
        </Text>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    width: 10000,
    opacity: 0,
    zIndex: -1,
  },
});
