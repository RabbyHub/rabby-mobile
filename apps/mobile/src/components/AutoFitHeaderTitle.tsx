import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { View } from 'react-native';
import type { TextLayoutEventData, NativeSyntheticEvent } from 'react-native';

import { Text } from '@/components/Typography';

// Base typography used by the header rows in this app.
const BASE_FONT_SIZE = 20;
const BASE_LINE_HEIGHT = 24;
// Fallback for a title that does not fit on one base line. Two compact lines
// (2 x 20pt) still fit inside the 48pt header row, so the page never reflows.
const COMPACT_FONT_SIZE = 16;
const COMPACT_LINE_HEIGHT = 20;

type Stage = 'base' | 'compact';

export type AutoFitHeaderTitleProps = {
  text: string;
  /** Extra text style (colour, family, weight); size/lineHeight are owned here. */
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Debug hook: reports what the measuring pass saw. */
  onMeasure?: (info: {
    stage: Stage;
    lineCount: number;
    firstLineWidth?: number;
  }) => void;
};

/**
 * Header title that keeps itself inside the slot it is given.
 *
 * Long translations (QA 1352) used to run past the header edge. This measures
 * the unclamped text once with the platform text engine (`onTextLayout`, so
 * Dynamic Type and per-locale metrics are included) and then picks one of two
 * layouts:
 *
 *   1. base    - 20pt, one line;
 *   2. compact - 16pt, two lines with a trailing ellipsis.
 *
 * A single measuring pass keeps it deterministic: the unclamped base-size text
 * either fits on one line or it does not. The container has a fixed height and
 * the text sits inside it, so switching layouts changes only the glyphs inside
 * the slot: the header row and the screen below keep their layout. A frame
 * where the title changes size is acceptable; a reflow of the page is not.
 */
export const AutoFitHeaderTitle = ({
  text,
  textStyle,
  containerStyle,
  onMeasure,
}: AutoFitHeaderTitleProps) => {
  const [stage, setStage] = React.useState<Stage>('base');

  // A new language (or a different title) starts from the base metrics again.
  React.useEffect(() => {
    setStage('base');
  }, [text]);

  const handleTextLayout = React.useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const lineCount = event.nativeEvent?.lines?.length ?? 0;
      const next: Stage = lineCount > 1 ? 'compact' : 'base';
      onMeasure?.({
        stage: next,
        lineCount,
        firstLineWidth: event.nativeEvent?.lines?.[0]?.width,
      });
      setStage(next);
    },
    [onMeasure],
  );

  const isCompact = stage === 'compact';
  const fontSize = isCompact ? COMPACT_FONT_SIZE : BASE_FONT_SIZE;
  const lineHeight = isCompact ? COMPACT_LINE_HEIGHT : BASE_LINE_HEIGHT;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        numberOfLines={isCompact ? 2 : 1}
        ellipsizeMode="tail"
        style={[
          styles.title,
          textStyle,
          { fontSize, lineHeight, textAlign: 'center' },
        ]}
        accessibilityRole="header">
        {text}
      </Text>
      {/* Unclamped twin used only for measurement: absolute, invisible and
          excluded from accessibility, so it cannot affect layout or the a11y
          tree. It always measures at the base metrics, which makes the result
          independent of the layout currently shown. */}
      <Text
        numberOfLines={0}
        onTextLayout={handleTextLayout}
        style={[
          styles.title,
          textStyle,
          styles.measure,
          {
            fontSize: BASE_FONT_SIZE,
            lineHeight: BASE_LINE_HEIGHT,
            textAlign: 'center',
          },
        ]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none">
        {text}
      </Text>
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
  title: {
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
  } as TextStyle,
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  } as TextStyle,
};
