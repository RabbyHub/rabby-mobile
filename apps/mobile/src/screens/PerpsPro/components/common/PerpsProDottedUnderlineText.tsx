import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useMemo, useState } from 'react';
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
  multiline?: boolean;
  numberOfLines?: number;
  onFirstLineLayout?: (
    line: Readonly<{ lineCount: number; width: number; x: number }>,
  ) => void;
  onPress?: () => void;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

const areUnderlineGeometryListsEqual = (
  current: readonly PerpsProDottedUnderlineGeometry[],
  next: readonly PerpsProDottedUnderlineGeometry[],
) =>
  current.length === next.length &&
  current.every((geometry, index) =>
    arePerpsProDottedUnderlineGeometriesEqual(
      geometry,
      next[index] ?? null,
      StyleSheet.hairlineWidth,
    ),
  );

type PerpsProDottedUnderlineCanvas = Readonly<{
  height: number;
  left: number;
  top: number;
  width: number;
}>;

const resolveUnderlineCanvas = (
  geometries: readonly PerpsProDottedUnderlineGeometry[],
): PerpsProDottedUnderlineCanvas | null => {
  const firstGeometry = geometries[0];
  if (!firstGeometry) {
    return null;
  }
  if (geometries.length === 1) {
    return {
      height: firstGeometry.canvasHeight,
      left: firstGeometry.canvasLeft,
      top: firstGeometry.canvasTop,
      width: firstGeometry.width,
    };
  }

  const bounds = geometries.reduce(
    (current, geometry) => ({
      bottom: Math.max(
        current.bottom,
        geometry.canvasTop + geometry.canvasHeight,
      ),
      left: Math.min(current.left, geometry.canvasLeft),
      right: Math.max(current.right, geometry.canvasLeft + geometry.width),
      top: Math.min(current.top, geometry.canvasTop),
    }),
    {
      bottom: firstGeometry.canvasTop + firstGeometry.canvasHeight,
      left: firstGeometry.canvasLeft,
      right: firstGeometry.canvasLeft + firstGeometry.width,
      top: firstGeometry.canvasTop,
    },
  );

  return {
    height: bounds.bottom - bounds.top,
    left: bounds.left,
    top: bounds.top,
    width: bounds.right - bounds.left,
  };
};

/**
 * React Native renders dotted text decoration as a solid underline on some
 * native versions. This Pro-private primitive draws deterministic dots while
 * keeping each underline exactly as wide as its rendered text line.
 */
export const PerpsProDottedUnderlineText: React.FC<
  PerpsProDottedUnderlineTextProps
> = ({
  accessibilityLabel,
  allowNaturalWidth = false,
  children,
  containerStyle,
  multiline = false,
  numberOfLines = 1,
  onFirstLineLayout,
  onPress,
  style,
  testID,
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const [underlineGeometries, setUnderlineGeometries] = useState<
    readonly PerpsProDottedUnderlineGeometry[]
  >([]);
  const flattenedTextStyle = StyleSheet.flatten(style);
  const fontSize =
    typeof flattenedTextStyle?.fontSize === 'number'
      ? flattenedTextStyle.fontSize
      : PERPS_PRO_DOTTED_UNDERLINE_DEFAULT_FONT_SIZE;
  const textColor =
    flattenedTextStyle?.color ?? colors2024['neutral-secondary'];
  const handleTextLayout = useCallback(
    (event: TextLayoutEvent) => {
      const { lines } = event.nativeEvent;
      const firstLine = lines[0] as
        | PerpsProDottedUnderlineLineMetrics
        | undefined;
      if (firstLine && Number.isFinite(firstLine.width)) {
        onFirstLineLayout?.({
          lineCount: lines.length,
          width: Math.max(firstLine.width, 0),
          x: Number.isFinite(firstLine.x) ? Math.max(firstLine.x ?? 0, 0) : 0,
        });
      }
      const underlineLines = (
        multiline ? lines : firstLine ? [firstLine] : []
      ) as readonly PerpsProDottedUnderlineLineMetrics[];
      const nextGeometries = underlineLines
        .map(line =>
          resolvePerpsProDottedUnderlineGeometry({
            fontSize,
            line,
            minimumStrokeWidth: StyleSheet.hairlineWidth,
            roundToNearestPixel: PixelRatio.roundToNearestPixel,
          }),
        )
        .filter(geometry => geometry.width > 0);
      setUnderlineGeometries(currentGeometries =>
        areUnderlineGeometryListsEqual(currentGeometries, nextGeometries)
          ? currentGeometries
          : nextGeometries,
      );
    },
    [fontSize, multiline, onFirstLineLayout],
  );

  const underlineCanvas = useMemo(
    () => resolveUnderlineCanvas(underlineGeometries),
    [underlineGeometries],
  );

  const content = (
    <>
      <Text
        numberOfLines={multiline ? undefined : numberOfLines}
        onTextLayout={handleTextLayout}
        style={style}>
        {children}
      </Text>
      {underlineCanvas ? (
        <View
          pointerEvents="none"
          style={[
            styles.underline,
            {
              height: underlineCanvas.height,
              left: underlineCanvas.left,
              top: underlineCanvas.top,
              width: underlineCanvas.width,
            },
          ]}
          testID="perps-pro-dotted-underline">
          <Svg height="100%" pointerEvents="none" width="100%">
            {underlineGeometries.map(geometry => {
              const lineY =
                geometry.canvasTop - underlineCanvas.top + geometry.lineY;
              return (
                <Line
                  key={`${geometry.canvasTop}:${geometry.canvasLeft}:${geometry.width}`}
                  stroke={textColor}
                  strokeDasharray={[geometry.dotLength, geometry.dotGap]}
                  strokeLinecap="round"
                  strokeWidth={geometry.strokeWidth}
                  x1={
                    geometry.canvasLeft - underlineCanvas.left + geometry.lineX1
                  }
                  x2={
                    geometry.canvasLeft - underlineCanvas.left + geometry.lineX2
                  }
                  y1={lineY}
                  y2={lineY}
                />
              );
            })}
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
