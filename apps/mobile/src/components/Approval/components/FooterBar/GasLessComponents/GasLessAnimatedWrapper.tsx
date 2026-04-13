import React, { PropsWithChildren, useEffect, useMemo } from 'react';

import { default as RcIconLogo } from '@/assets/icons/sign/tx/rabby.svg';

import { useThemeColors } from '@/hooks/theme';
import { renderText } from '@/utils/renderNode';
import { colord } from 'colord';
import {
  DimensionValue,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export const GasLessAnimatedWrapper = (
  props: PropsWithChildren<{
    gasLess?: boolean;
    title: string;
    icon?: React.ReactNode;
    titleStyle: StyleProp<TextStyle>;
    buttonStyle: StyleProp<ViewStyle>;
    showOrigin: boolean;
    type?: 'submit' | 'process';
    gasLessThemeColor?: string;
    isGasNotEnough?: boolean;
  }>,
) => {
  const colors = useThemeColors();

  const logoXValue = useSharedValue(-30);

  const logoYValue = useSharedValue(0);

  const hiddenAnimated = useSharedValue(0);

  const overlayStyle = useAnimatedStyle(
    () => ({
      position: 'absolute',
      opacity: props?.isGasNotEnough ? 0.5 : 0,
      width: '110%',
      height: '100%',
      top: 0,
      backgroundColor: colors['neutral-bg-1'],
      left: (interpolate(logoXValue.value, [-30, 100], [-30, 100]) +
        '%') as DimensionValue,
    }),
    [colors, props?.isGasNotEnough],
  );

  const logoStyle = useAnimatedStyle(() => ({
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: (logoXValue.value + '%') as DimensionValue,
    transform: [{ translateY: logoYValue.value }],
  }));

  const blueBgStyle = useAnimatedStyle(
    () => ({
      width: '200%',
      height: '100%',
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: props?.gasLessThemeColor
        ? props?.gasLessThemeColor
        : colors['blue-default'],
      left: (interpolate(logoXValue.value, [-30, 100], [-210, -100]) +
        '%') as DimensionValue,
    }),
    [props?.gasLessThemeColor],
  );

  const processBgColor = useMemo(
    () => colord(colors['blue-default']).alpha(0.5).toRgbString(),
    [colors],
  );
  const buttonBgStyle = useMemo(
    () => ({
      backgroundColor:
        props.type === 'process' ? 'transparent' : colors['blue-default'],
    }),
    [colors, props.type],
  );

  const bgStyle = useAnimatedStyle(
    () =>
      logoXValue.value > 100 && props?.gasLessThemeColor
        ? {
            backgroundColor: props?.gasLessThemeColor,
          }
        : logoXValue.value > -10 && props?.isGasNotEnough
        ? {
            backgroundColor: processBgColor,
          }
        : {},
    [props?.gasLessThemeColor, props?.isGasNotEnough],
  );

  const start = React.useCallback(() => {
    logoXValue.value = withTiming(100, {
      duration: 900,
      easing: Easing.linear,
    });

    const config = {
      duration: 112.5,
      easing: Easing.linear,
    };

    logoYValue.value = withRepeat(
      withSequence(
        withTiming(-16, config),
        withTiming(0, config),
        withTiming(16, config),
        withTiming(0, config),
      ),
      2,
      true,
    );

    hiddenAnimated.value = withDelay(
      910,
      withTiming(1, {
        duration: 0,
      }),
    );
  }, [hiddenAnimated, logoXValue, logoYValue]);

  const showOriginButtonStyle = useAnimatedStyle(() => ({
    display: hiddenAnimated.value === 1 ? 'flex' : 'none',
  }));

  const showAnimatedButtonStyle = useAnimatedStyle(() => ({
    display: hiddenAnimated.value === 1 ? 'none' : 'flex',
  }));

  useEffect(() => {
    if (props.gasLess) {
      start();
    }
  }, [start, props.gasLess]);

  if (props.showOrigin) {
    return <>{props.children}</>;
  }

  return (
    <>
      <Animated.View style={showOriginButtonStyle}>
        {props.children}
      </Animated.View>
      <Animated.View style={[styles.animatedWrap, showAnimatedButtonStyle]}>
        <Animated.View
          style={[
            styles.animatedButton,
            buttonBgStyle,
            props.buttonStyle,
            bgStyle,
          ]}>
          <Animated.View style={blueBgStyle} />

          {props?.icon ? (
            <Animated.View style={styles.iconWrap}>{props?.icon}</Animated.View>
          ) : null}

          {renderText(props.title, {
            style: StyleSheet.flatten([
              props.titleStyle,
              props.gasLess ? { color: colors['neutral-title-2'] } : {},
            ]),
          })}
        </Animated.View>
        <Animated.View style={overlayStyle} />
        <Animated.View style={logoStyle}>
          {props.gasLessThemeColor ? null : (
            <RcIconLogo width={24} height={24} />
          )}
        </Animated.View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  animatedWrap: {
    overflow: 'hidden',
    width: '100%',
  },
  animatedButton: {
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 0,
    width: '100%',
  },
  iconWrap: {
    marginRight: 8,
  },
});
