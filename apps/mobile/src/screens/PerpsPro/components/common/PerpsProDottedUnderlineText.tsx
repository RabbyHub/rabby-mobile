import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';

const UNDERLINE_STROKE_WIDTH = StyleSheet.hairlineWidth;
const UNDERLINE_DOT_LENGTH = UNDERLINE_STROKE_WIDTH;
const UNDERLINE_DOT_GAP = UNDERLINE_STROKE_WIDTH * 2;
const UNDERLINE_CANVAS_HEIGHT = 1;
const UNDERLINE_Y = UNDERLINE_CANVAS_HEIGHT - UNDERLINE_STROKE_WIDTH / 2;

interface PerpsProDottedUnderlineTextProps {
  allowNaturalWidth?: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  onPress?: () => void;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * React Native renders dotted text decoration as a solid underline on some
 * native versions. This Pro-private primitive draws deterministic dots while
 * keeping the underline exactly as wide as the rendered label.
 */
export const PerpsProDottedUnderlineText: React.FC<
  PerpsProDottedUnderlineTextProps
> = ({
  accessibilityLabel,
  allowNaturalWidth = false,
  children,
  containerStyle,
  numberOfLines = 1,
  onPress,
  style,
  testID,
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const [textWidth, setTextWidth] = useState(0);
  const textColor =
    StyleSheet.flatten(style)?.color ?? colors2024['neutral-secondary'];
  const handleTextLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setTextWidth(currentWidth =>
      Math.abs(currentWidth - nextWidth) < StyleSheet.hairlineWidth
        ? currentWidth
        : nextWidth,
    );
  }, []);

  const content = (
    <>
      <Text
        numberOfLines={numberOfLines}
        onLayout={handleTextLayout}
        style={style}>
        {children}
      </Text>
      {textWidth > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.underline, { width: textWidth }]}
          testID="perps-pro-dotted-underline">
          <Svg height="100%" pointerEvents="none" width="100%">
            <Line
              stroke={textColor}
              strokeDasharray={[UNDERLINE_DOT_LENGTH, UNDERLINE_DOT_GAP]}
              strokeLinecap="round"
              strokeWidth={UNDERLINE_STROKE_WIDTH}
              x1={0}
              x2="100%"
              y1={UNDERLINE_Y}
              y2={UNDERLINE_Y}
            />
          </Svg>
        </View>
      ) : null}
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.container,
        allowNaturalWidth
          ? styles.naturalWidthContainer
          : styles.boundedContainer,
        containerStyle,
      ]}
      testID={testID}>
      {content}
    </Pressable>
  ) : (
    <View
      style={[
        styles.container,
        allowNaturalWidth
          ? styles.naturalWidthContainer
          : styles.boundedContainer,
        containerStyle,
      ]}
      testID={testID}>
      {content}
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  container: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    position: 'relative',
  },
  boundedContainer: {
    maxWidth: '100%',
  },
  naturalWidthContainer: {
    flexShrink: 0,
  },
  underline: {
    bottom: 0,
    height: UNDERLINE_CANVAS_HEIGHT,
    left: 0,
    position: 'absolute',
  },
}));
