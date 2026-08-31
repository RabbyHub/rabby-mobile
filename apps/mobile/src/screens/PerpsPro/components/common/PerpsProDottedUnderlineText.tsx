import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useState } from 'react';
import {
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextLayoutEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';

import {
  arePerpsProDottedUnderlineGeometriesEqual,
  PERPS_PRO_DOTTED_UNDERLINE_DEFAULT_FONT_SIZE,
  resolvePerpsProDottedUnderlineGeometry,
  type PerpsProDottedUnderlineGeometry,
  type PerpsProDottedUnderlineLineMetrics,
} from './perpsProDottedUnderlineGeometry';

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
  const [underlineGeometry, setUnderlineGeometry] =
    useState<PerpsProDottedUnderlineGeometry | null>(null);
  const flattenedTextStyle = StyleSheet.flatten(style);
  const fontSize =
    typeof flattenedTextStyle?.fontSize === 'number'
      ? flattenedTextStyle.fontSize
      : PERPS_PRO_DOTTED_UNDERLINE_DEFAULT_FONT_SIZE;
  const textColor =
    flattenedTextStyle?.color ?? colors2024['neutral-secondary'];
  const handleTextLayout = useCallback(
    (event: TextLayoutEvent) => {
      const line = event.nativeEvent.lines[0] as
        | PerpsProDottedUnderlineLineMetrics
        | undefined;
      const nextGeometry = line
        ? resolvePerpsProDottedUnderlineGeometry({
            fontSize,
            line,
            minimumStrokeWidth: StyleSheet.hairlineWidth,
            roundToNearestPixel: PixelRatio.roundToNearestPixel,
          })
        : null;
      setUnderlineGeometry(currentGeometry =>
        arePerpsProDottedUnderlineGeometriesEqual(
          currentGeometry,
          nextGeometry,
          StyleSheet.hairlineWidth,
        )
          ? currentGeometry
          : nextGeometry,
      );
    },
    [fontSize],
  );

  const content = (
    <>
      <Text
        numberOfLines={numberOfLines}
        onTextLayout={handleTextLayout}
        style={style}>
        {children}
      </Text>
      {underlineGeometry && underlineGeometry.width > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.underline,
            {
              height: underlineGeometry.canvasHeight,
              top: underlineGeometry.canvasTop,
              width: underlineGeometry.width,
            },
          ]}
          testID="perps-pro-dotted-underline">
          <Svg height="100%" pointerEvents="none" width="100%">
            <Line
              stroke={textColor}
              strokeDasharray={[
                underlineGeometry.dotLength,
                underlineGeometry.dotGap,
              ]}
              strokeLinecap="round"
              strokeWidth={underlineGeometry.strokeWidth}
              x1={underlineGeometry.lineX1}
              x2={underlineGeometry.lineX2}
              y1={underlineGeometry.lineY}
              y2={underlineGeometry.lineY}
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
    left: 0,
    position: 'absolute',
  },
}));
