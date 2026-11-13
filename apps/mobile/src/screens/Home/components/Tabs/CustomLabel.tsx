// ((props: TabItemProps<T>) => React.ReactNode);
import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, { clamp, useAnimatedStyle } from 'react-native-reanimated';
import { PixelRatio, StyleSheet, TextProps, View } from 'react-native';
import { ThemeColors2024 } from '@rabby-wallet/base-utils';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { Text } from '@/components/Typography';

interface CustomLabelProps {
  index: number;
  indexDecimal: Animated.SharedValue<number>;
  icon?: React.ReactNode;
  text: string;
  activeColor?: string;
  inactiveColor?: string;
  activeFontWeight?: string;
  inactiveFontWeight?: string;
  activeFontSize?: number;
  inactiveFontSize?: number;
  style?: TextProps['style'];
}

const LABEL_WIDTH = 70;
// Snap animated offsets to whole device pixels. A translated text layer that
// lands on sub-pixel offsets is re-rasterised at every step, which reads as a
// horizontal shimmer/tremble while the row is moving.
const PIXEL = PixelRatio.get();
/** Last asset tab; the plate never animates outside the asset range. */
const MAX_ASSET_INDEX = 3;

function snapToPixel(value: number) {
  'worklet';
  return Math.round(value * PIXEL) / PIXEL;
}
// Park the plate a hair past the label edge: at exactly `width` its antialiased
// edge still touches the clip boundary and leaves a 1px seam.
const PLATE_TRAVEL = LABEL_WIDTH + 1;

/**
 * One tab label. The active chip (black plate + white text) is a *moving,
 * clipped* layer instead of a fading one:
 *
 *   container ── grey text (static)
 *     └ mover (width = label, translateX = d * width, overflow hidden)
 *          ├ black plate
 *          └ white text (translateX = -d * width, i.e. pinned on screen)
 *
 * `d = track - index`, so dragging towards the next tab slides this tab's plate
 * out to the right and the next tab's plate in from the left; both are clipped
 * by their own label box, and the gap between labels stays empty, so the plate
 * reads as if it passes behind the wall between them. The counter-translated
 * white text keeps its glyphs in place and is only visible where the plate
 * still covers them — the text turns back to the inactive colour exactly where
 * the plate has left.
 *
 * Only `transform` is animated: no `color`, `backgroundColor`, width or text
 * prop is written from the worklet.
 */
const CustomLabel = ({
  index,
  indexDecimal,
  text,
  style,
}: CustomLabelProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  // The plate only travels *between asset tabs*. The overview boundary is the
  // whole strip riding in, so the plate must stay fully covering its own label
  // there - otherwise the label and its plate move at different speeds and the
  // row looks like it is trembling.
  const plateOffset = (track: number) => {
    'worklet';
    return clamp(clamp(track, 1, MAX_ASSET_INDEX) - index, -1, 1);
  };

  const moverStyle = useAnimatedStyle(() => {
    const d = plateOffset(indexDecimal.value);
    return { transform: [{ translateX: snapToPixel(d * PLATE_TRAVEL) }] };
  });
  const pinnedTextStyle = useAnimatedStyle(() => {
    const d = plateOffset(indexDecimal.value);
    return { transform: [{ translateX: -snapToPixel(d * PLATE_TRAVEL) }] };
  });

  return (
    <Animated.View style={styles.container}>
      <Text style={[styles.label, styles.labelInactive, style]}>{text}</Text>
      <Animated.View style={[styles.mover, moverStyle]}>
        <View style={styles.plate} />
        <Animated.Text
          style={[styles.label, styles.labelActive, style, pinnedTextStyle]}>
          {text}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
};

export default CustomLabel;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: HOME_TOP_HEADER_SIZES.headerTabItemHeight,
    width: LABEL_WIDTH,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // Same box as the label, free to slide; clips both the plate and the text.
  mover: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: LABEL_WIDTH,
    height: HOME_TOP_HEADER_SIZES.headerTabItemHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  plate: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: isLight
      ? ThemeColors2024.dark['neutral-bg-1']
      : colors2024['neutral-bg-1'],
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textTransform: 'none',
    textAlign: 'center',
  },
  labelInactive: {
    color: colors2024['neutral-secondary'],
  },
  labelActive: {
    color: isLight
      ? ThemeColors2024.dark['neutral-title-1']
      : ThemeColors2024.light['neutral-title-1'],
  },
}));
