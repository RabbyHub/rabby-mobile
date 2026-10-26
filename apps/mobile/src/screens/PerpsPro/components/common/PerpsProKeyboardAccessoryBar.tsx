import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, {
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT } from './perpsProKeyboardSession';
import { PERPS_PRO_NUMBER_STYLE } from './perpsProNumberText';

const consumeTouch = () => true;
// Approved Figma 83992:157364 colors, scoped to this accessory.
const DONE_COLOR = '#23C0B0';
const SHADOW_COLOR = '#494B5B';
const TOP_RADIUS = 14;
const SHADOW_OFFSET_Y = -8;
const SHADOW_BLUR = 12;
const SHADOW_OPACITY = 0.06;
const SHADOW_TOP = SHADOW_BLUR - SHADOW_OFFSET_Y;
const SHADOW_CORNER_RADIUS = TOP_RADIUS + SHADOW_BLUR;

// Gaussian falloff for Figma's blur=12 (sigma=6), sampled from the inside
// of the 14pt corner to its outer blur edge. Radial corner gradients join
// linear edge gradients; no Android elevation or bitmap filter is needed.
const shadowStops = [
  [0, 0.990185],
  [4 / 26, 0.95221],
  [8 / 26, 0.841345],
  [12 / 26, 0.630559],
  [14 / 26, 0.5],
  [18 / 26, 0.252493],
  [22 / 26, 0.091211],
  [1, 0.02275],
].map(([offset, opacity]) => (
  <Stop
    key={offset}
    offset={offset}
    stopColor={SHADOW_COLOR}
    stopOpacity={opacity * SHADOW_OPACITY}
  />
));

const AndroidAccessoryShadow = React.memo(({ width }: { width: number }) => (
  <Svg
    pointerEvents="none"
    width={width}
    height={SHADOW_TOP + TOP_RADIUS}
    style={stylesOverlay.androidShadow}
    testID="perps-pro-keyboard-android-shadow">
    <Defs>
      <LinearGradient
        id="pro-keyboard-shadow-top"
        gradientUnits="userSpaceOnUse"
        x1={0}
        y1={SHADOW_CORNER_RADIUS}
        x2={0}
        y2={0}>
        {shadowStops}
      </LinearGradient>
      <RadialGradient
        id="pro-keyboard-shadow-corner"
        gradientUnits="userSpaceOnUse"
        cx={TOP_RADIUS}
        cy={SHADOW_CORNER_RADIUS}
        r={SHADOW_CORNER_RADIUS}>
        {shadowStops}
      </RadialGradient>
      <LinearGradient
        id="pro-keyboard-shadow-side"
        gradientUnits="userSpaceOnUse"
        x1={TOP_RADIUS}
        y1={0}
        x2={-SHADOW_BLUR}
        y2={0}>
        {shadowStops}
      </LinearGradient>
    </Defs>
    <Rect
      x={TOP_RADIUS}
      width={Math.max(0, width - TOP_RADIUS * 2)}
      height={SHADOW_TOP + TOP_RADIUS}
      fill="url(#pro-keyboard-shadow-top)"
    />
    {[false, true].map(right => (
      <G
        key={String(right)}
        transform={right ? `translate(${width} 0) scale(-1 1)` : undefined}>
        <Rect
          width={TOP_RADIUS}
          height={SHADOW_CORNER_RADIUS}
          fill="url(#pro-keyboard-shadow-corner)"
        />
        <Rect
          y={SHADOW_CORNER_RADIUS}
          width={TOP_RADIUS}
          height={-SHADOW_OFFSET_Y}
          fill="url(#pro-keyboard-shadow-side)"
        />
      </G>
    ))}
  </Svg>
));

export const PerpsProKeyboardAccessoryBar = ({
  minimum,
  onDone,
  width,
}: {
  minimum: string | null;
  onDone: () => void;
  width: number;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={styles.shadow} testID="perps-pro-keyboard-shadow">
      {Platform.OS === 'android' ? (
        <AndroidAccessoryShadow width={width} />
      ) : null}
      <View
        onStartShouldSetResponder={consumeTouch}
        style={styles.bar}
        testID="perps-pro-keyboard-accessory">
        {minimum ? (
          <Text
            numberOfLines={1}
            style={styles.minimum}
            testID="perps-pro-keyboard-minimum">
            {t('page.perps.pro.trade.keyboardMinimum', { amount: minimum })}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('global.Done')}
          onPress={onDone}
          style={styles.done}
          testID="perps-pro-keyboard-done">
          <Text style={styles.doneText}>{t('global.Done')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const stylesOverlay = StyleSheet.create({
  androidShadow: { position: 'absolute', top: -SHADOW_TOP, left: 0 },
});
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  shadow: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: TOP_RADIUS,
    borderTopRightRadius: TOP_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'visible',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: SHADOW_COLOR,
          shadowOffset: { width: 0, height: SHADOW_OFFSET_Y },
          shadowRadius: SHADOW_BLUR / 2,
          shadowOpacity: SHADOW_OPACITY,
        }
      : {}),
  },
  bar: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT,
    borderTopLeftRadius: TOP_RADIUS,
    borderTopRightRadius: TOP_RADIUS,
    overflow: 'hidden',
  },
  minimum: {
    ...PERPS_PRO_NUMBER_STYLE,
    position: 'absolute',
    left: 16,
    right: 80,
    top: 15,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  done: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    paddingLeft: 16,
    paddingRight: 20,
    paddingTop: 14,
  },
  doneText: {
    color: DONE_COLOR,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
}));
