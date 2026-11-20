import React from 'react';
import type {
  LayoutChangeEvent,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { View } from 'react-native';
import type { TextLayoutEventData, NativeSyntheticEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import { RoundedFontStyles } from '@/core/utils/fonts';

// Base typography used by the header rows in this app.
const BASE_FONT_SIZE = 20;
const BASE_LINE_HEIGHT = 24;
// Fallback for a title that does not fit on one base line. Two compact lines
// (2 x 20pt) still fit inside the 48pt header row, so the page never reflows.
const COMPACT_FONT_SIZE = 16;
const COMPACT_LINE_HEIGHT = 20;

type Stage = 'base' | 'compact';

/**
 * Per-language typography for a header title.
 *
 * - `'auto'`  : keep the adaptive behaviour (measure the slot, shrink to the
 *               compact two-line layout when the base size does not fit);
 * - an object : fixed metrics for that language. Only measurements are allowed:
 *               font family/weight are owned by this component so the shared
 *               Rounded/Heavy contract stays intact (QA 1387/1388).
 */
export type HeaderTitleLanguageStyle =
  | 'auto'
  | {
      textStyle?: TextStyle;
      numberOfLines?: 1 | 2;
      ellipsizeMode?: 'tail' | 'clip';
    };

export type AutoFitHeaderTitleProps = {
  text: string;
  /** Extra text style (colour, family, weight); size/lineHeight are owned here. */
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Horizontal alignment inside the slot. Defaults to the centred header row. */
  align?: 'left' | 'center';
  /** Debug hook: reports what the measuring pass saw. */
  onMeasure?: (info: {
    stage: Stage;
    lineCount: number;
    firstLineWidth?: number;
  }) => void;
  /**
   * Exact language tag -> typography override (e.g. `en-US`, `pt-PT`; no prefix
   * matching). When a tag has no entry the component renders the English
   * baseline: base size, one line, tail ellipsis, and no measuring at all.
   */
  textStylesByLanguage?: Partial<Record<string, HeaderTitleLanguageStyle>>;
  /**
   * Pre-resolved policy for the active language. Takes precedence over
   * `textStylesByLanguage`; use it when the caller already knows the live
   * layout width (e.g. `resolveHeaderTitleLanguageStyle(...)`).
   */
  languageStyle?: HeaderTitleLanguageStyle;
  /** Forces the language key (tests/playground); defaults to the i18n one. */
  languageKey?: string;
};

/**
 * Header title that keeps itself inside the slot it is given.
 *
 * The default layout is the English design: base size, one line, tail
 * ellipsis. It is deterministic - no measuring, no stage changes - so entering
 * the screen always renders the same thing (QA 1409: the title used to flip
 * between 20pt/two lines and 16pt/one line depending on the entry).
 *
 * Languages that need more room opt into `'auto'` through
 * `textStylesByLanguage`, which keeps the long-translation behaviour from QA
 * 1352: measure the real slot width once and fall back to the compact
 * two-line layout only when the base size genuinely overflows.
 */
export const AutoFitHeaderTitle = ({
  text,
  textStyle,
  containerStyle,
  align = 'center',
  onMeasure,
  textStylesByLanguage,
  languageStyle,
  languageKey,
}: AutoFitHeaderTitleProps) => {
  const { i18n } = useTranslation();
  const activeLanguage =
    languageKey || i18n?.resolvedLanguage || i18n?.language || '';

  const mappedLanguageStyle = React.useMemo(() => {
    if (!textStylesByLanguage || !activeLanguage) {
      return undefined;
    }
    return textStylesByLanguage[activeLanguage];
  }, [textStylesByLanguage, activeLanguage]);

  const activeLanguageStyle = languageStyle ?? mappedLanguageStyle;
  const isAdaptive = activeLanguageStyle === 'auto';
  const fixedStyle =
    activeLanguageStyle !== 'auto' ? activeLanguageStyle : undefined;

  // The map is an object prop, so nothing downstream may depend on its
  // identity: a scalar signature keeps re-computation and style churn tied to
  // the actual metrics instead of to the caller's render count.
  const fixedSignature = fixedStyle
    ? [
        fixedStyle.textStyle?.fontSize ?? BASE_FONT_SIZE,
        fixedStyle.textStyle?.lineHeight ?? BASE_LINE_HEIGHT,
        fixedStyle.numberOfLines ?? 1,
        fixedStyle.ellipsizeMode ?? 'tail',
      ].join('|')
    : '';

  const fixedMetrics = React.useMemo(() => {
    if (!fixedStyle) {
      return undefined;
    }
    const {
      fontFamily: _family,
      fontWeight: _weight,
      ...metrics
    } = fixedStyle.textStyle ?? {};
    return {
      metrics,
      numberOfLines: fixedStyle.numberOfLines ?? 1,
      ellipsizeMode: fixedStyle.ellipsizeMode ?? 'tail',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedSignature]);

  // Adaptive path only ('auto' languages).
  const [stage, setStage] = React.useState<Stage>('base');
  const [containerWidth, setContainerWidth] = React.useState(0);
  const measuredRef = React.useRef<{ width: number; text: string } | null>(
    null,
  );

  const handleContainerLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.round(event.nativeEvent.layout.width);
      setContainerWidth(prev => (prev === nextWidth ? prev : nextWidth));
    },
    [],
  );

  // A new language, title or slot width restarts the measurement so the
  // verdict is not carried over from a different layout.
  React.useEffect(() => {
    if (!isAdaptive) {
      return;
    }
    measuredRef.current = null;
    setStage('base');
  }, [isAdaptive, text, containerWidth]);

  const handleTextLayout = React.useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (!isAdaptive) {
        return;
      }
      const lines = event.nativeEvent?.lines ?? [];
      // Measurements taken before the slot has a real width are meaningless.
      if (containerWidth <= 0 || lines.length === 0) {
        return;
      }
      const measured = measuredRef.current;
      if (measured?.width === containerWidth && measured.text === text) {
        return;
      }
      measuredRef.current = { width: containerWidth, text };
      const lineCount = lines.length;
      const next: Stage = lineCount > 1 ? 'compact' : 'base';
      onMeasure?.({
        stage: next,
        lineCount,
        firstLineWidth: lines[0]?.width,
      });
      setStage(next);
    },
    [isAdaptive, onMeasure, containerWidth, text],
  );

  const isCompact = isAdaptive && stage === 'compact';
  const fontSize =
    fixedMetrics?.metrics.fontSize ??
    (isCompact ? COMPACT_FONT_SIZE : BASE_FONT_SIZE);
  const lineHeight =
    fixedMetrics?.metrics.lineHeight ??
    (isCompact ? COMPACT_LINE_HEIGHT : BASE_LINE_HEIGHT);
  const numberOfLines = isAdaptive ? 2 : fixedMetrics?.numberOfLines ?? 1;
  const ellipsizeMode = fixedMetrics?.ellipsizeMode ?? 'tail';
  const textAlign = align === 'left' ? 'left' : 'center';

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={isAdaptive ? handleContainerLayout : undefined}>
      <Text
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        style={[
          styles.title,
          textStyle,
          fixedMetrics?.metrics,
          { fontSize, lineHeight, textAlign },
        ]}
        accessibilityRole="header">
        {text}
      </Text>
      {isAdaptive ? (
        /* Unclamped twin used only for measurement: absolute, invisible and
           excluded from accessibility, so it cannot affect layout or the a11y
           tree. It always measures at the base metrics, which makes the result
           independent of the layout currently shown. */
        <Text
          // Re-mounting the probe on a width change makes it lay out (and
          // report) again at the new width instead of keeping a stale verdict.
          key={`probe-${containerWidth}`}
          numberOfLines={0}
          onTextLayout={handleTextLayout}
          style={[
            styles.title,
            textStyle,
            styles.measure,
            {
              width: containerWidth > 0 ? containerWidth : undefined,
              fontSize: BASE_FONT_SIZE,
              lineHeight: BASE_LINE_HEIGHT,
              textAlign,
            },
          ]}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none">
          {text}
        </Text>
      ) : null}
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    // Fill the slot even when the parent centres its children: otherwise the
    // unclamped measuring twin reports a single, very wide line and no
    // overflow is ever detected.
    alignSelf: 'stretch',
    justifyContent: 'center',
  } as ViewStyle,
  // This object is not passed through `createGetStyles2024`/`mutateStyles`,
  // so it must use the resolved Android file name (SF-Pro-Rounded-Heavy). A raw
  // 'SF Pro Rounded' + fontWeight 800 fell back to a synthetic face on Android
  // and rendered differently from the baseline header (QA 1387/1388).
  title: { ...RoundedFontStyles.heavy } as TextStyle,
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  } as TextStyle,
};
