import { useTheme2024 } from '@/hooks/theme';
import React, { forwardRef } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  ViewProps,
} from 'react-native';
import LinearGradient, {
  LinearGradientProps,
} from 'react-native-linear-gradient';

type GradientOutlineContainerProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  borderWidth?: number;
  contentBackgroundColor?: string;
  gradientColors?: LinearGradientProps['colors'];
  gradientLocations?: LinearGradientProps['locations'];
  gradientStart?: LinearGradientProps['start'];
  gradientEnd?: LinearGradientProps['end'];
} & Pick<ViewProps, 'pointerEvents'>;

/**
 * Creates a frosted style card with a vertical gradient border that matches the
 * latest Figma spec for the multi-address home layout.
 */
export const GradientOutlineContainer = forwardRef<
  View,
  GradientOutlineContainerProps
>((props, ref) => {
  const { isLight } = useTheme2024();
  const {
    children,
    style,
    contentStyle,
    borderRadius = 16,
    borderWidth = 1.5,
    gradientColors = isLight
      ? [
          'rgba(255, 255, 255, 0.48)',
          'rgba(255, 255, 255, 0.18)',
          'rgba(255, 255, 255, 0.0)',
        ]
      : ['rgba(35, 36, 40, 1)', 'rgba(35, 36, 40, 0)', 'rgba(35, 36, 40, 0)'],
    gradientLocations = isLight ? [0, 0.46, 1] : [0, 0.11, 1],
    gradientStart = { x: 0.5, y: 0 },
    gradientEnd = isLight ? { x: 0.5, y: 1 } : { x: 0.5, y: 1 },
    pointerEvents,
  } = props;

  const innerRadius = Math.max(borderRadius - borderWidth, 0);

  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      start={gradientStart}
      end={gradientEnd}
      style={[
        styles.gradientWrapper,
        {
          borderRadius,
          padding: borderWidth,
        },
        style,
      ]}>
      <View
        pointerEvents={pointerEvents}
        ref={ref}
        style={[
          styles.content,
          {
            borderRadius: innerRadius,
            backgroundColor: 'transparent',
          },
          contentStyle,
        ]}>
        {children}
      </View>
    </LinearGradient>
  );
});

GradientOutlineContainer.displayName = 'GradientOutlineContainer';

const styles = StyleSheet.create({
  gradientWrapper: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
});
