import React, { PropsWithChildren, useEffect, useMemo } from 'react';
import { default as RcIconGasLight } from '@/assets/icons/sign/tx/gas-light.svg';
import { default as RcIconGasDark } from '@/assets/icons/sign/tx/gas-dark.svg';

import { useTranslation } from 'react-i18next';
import { default as RcIconLogo } from '@/assets/icons/sign/tx/rabby.svg';

import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';

import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  TextStyle,
  ViewStyle,
  DimensionValue,
  StyleSheet,
} from 'react-native';
import { makeThemeIcon } from '@/hooks/makeThemeIcon';
import LinearGradient from 'react-native-linear-gradient';
import { StyleProp } from 'react-native';
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
import { renderText } from '@/utils/renderNode';

const RcIconGas = makeThemeIcon(RcIconGasLight, RcIconGasDark);

export function GasLessNotEnough() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.securityLevelTip}>
      <View style={styles.tipTriangle} />
      <RcIconGas
        width={16}
        height={16}
        color={colors['neutral-title-1']}
        style={{ marginRight: 4 }}
      />
      <Text style={styles.text}>
        {t('page.signFooterBar.gasless.unavailable')}
      </Text>
    </View>
  );
}

function FreeGasReady() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View
      style={{
        width: '100%',
        height: 58,
      }}>
      <ImageBackground
        source={require('@/assets/icons/sign/tx/bg.png')}
        resizeMode="contain"
        style={{
          flexDirection: 'row',
          paddingLeft: 16,
          height: 46,
          paddingTop: 18,
        }}>
        <RcIconLogo width={16} height={16} style={{ marginRight: 4 }} />
        <Text style={styles.text}>
          {t('page.signFooterBar.gasless.rabbyPayGas')}
        </Text>
      </ImageBackground>
    </View>
  );
}

export function GasLessToSign({
  handleFreeGas,
  gasLessEnable,
}: {
  handleFreeGas: () => void;
  gasLessEnable: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const hiddenAnimated = useSharedValue(0);

  const toSignStyle = useAnimatedStyle(() => ({
    display: hiddenAnimated.value !== 1 ? 'flex' : 'none',
  }));

  const confirmedStyled = useAnimatedStyle(() => ({
    display: hiddenAnimated.value === 1 ? 'flex' : 'none',
  }));

  const startAnimation = React.useCallback(() => {
    hiddenAnimated.value = withDelay(
      900,
      withTiming(1, {
        duration: 0,
      }),
    );
  }, [hiddenAnimated]);

  useEffect(() => {
    if (gasLessEnable) {
      startAnimation();
    }
  }, [gasLessEnable, startAnimation]);

  return (
    <>
      <Animated.View style={toSignStyle}>
        <View style={styles.securityLevelTip}>
          <View style={styles.tipTriangle} />
          <RcIconGas
            width={16}
            height={16}
            color={colors['neutral-title-1']}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.text, styles.gasText]}>
            {t('page.signFooterBar.gasless.notEnough')}
          </Text>
          <TouchableOpacity onPress={handleFreeGas}>
            <LinearGradient
              colors={['#60bcff', '#8154ff']}
              locations={[0.1447, 0.9383]}
              useAngle
              angle={94}
              style={styles.linearGradient}>
              <Text style={styles.linearGradientText}>
                {t('page.signFooterBar.gasless.GetFreeGasToSign')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
      <Animated.View style={confirmedStyled}>
        <FreeGasReady />
      </Animated.View>
    </>
  );
}

export const GasLessAnimatedWrapper = (
  props: PropsWithChildren<{
    gasLess?: boolean;
    title: string;
    titleStyle: StyleProp<TextStyle>;
    buttonStyle: StyleProp<ViewStyle>;
    showOrigin: boolean;
    type?: 'submit' | 'process';
  }>,
) => {
  const colors = useThemeColors();

  const blueBgXValue = useSharedValue(-200);

  const logoXValue = useSharedValue(-10);

  const logoYValue = useSharedValue(0);

  const hiddenAnimated = useSharedValue(0);

  const overlayStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    opacity: 0.5,
    width: '100%',
    height: '100%',
    top: 0,
    backgroundColor: 'white',
    left: (interpolate(logoXValue.value, [-10, 100], [0, 105]) +
      '%') as DimensionValue, //(overlayValue.value + '%') as DimensionValue,
  }));

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

  const blueBgStyle = useAnimatedStyle(() => ({
    width: '200%',
    height: '100%',
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors['blue-default'],
    left: (blueBgXValue.value + '%') as DimensionValue,
  }));

  const start = React.useCallback(() => {
    blueBgXValue.value = withTiming(-100, {
      duration: 900,
      easing: Easing.linear,
    });

    logoXValue.value = withTiming(100, {
      duration: 900,
      easing: Easing.linear,
    });

    const config = {
      duration: 75,
      easing: Easing.linear,
    };

    logoYValue.value = withRepeat(
      withSequence(
        withTiming(-16, config),
        withTiming(0, config),
        withTiming(16, config),
        withTiming(0, config),
      ),
      3,
      true,
    );

    hiddenAnimated.value = withDelay(
      910,
      withTiming(1, {
        duration: 0,
      }),
    );
  }, [blueBgXValue, hiddenAnimated, logoXValue, logoYValue]);

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
      <Animated.View
        style={[
          {
            overflow: 'hidden',
            width: '100%',
          },
          showAnimatedButtonStyle,
        ]}>
        <Animated.View
          style={[
            {
              overflow: 'hidden',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 8,
              paddingHorizontal: 0,
              width: '100%',
              backgroundColor:
                props.type === 'process'
                  ? 'transparent'
                  : colors['blue-default'],
            },
            props.buttonStyle,
          ]}>
          <Animated.View style={blueBgStyle} />

          <Animated.View style={logoStyle}>
            <RcIconLogo width={16} height={16} />
          </Animated.View>
          {renderText(props.title, {
            style: StyleSheet.flatten([
              props.titleStyle,
              props.gasLess ? { color: colors['neutral-title-2'] } : {},
            ]),
          })}
        </Animated.View>
        <Animated.View style={overlayStyle} />
      </Animated.View>
    </>
  );
};

const getStyles = createGetStyles(colors => ({
  securityLevelTip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    backgroundColor: colors['neutral-card-2'],
    color: colors['neutral-card-2'],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    position: 'relative',
  },
  tipTriangle: {
    position: 'absolute',
    top: -13,
    left: 110,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: colors['neutral-card-2'],
  },
  text: {
    flex: 1,
    color: colors['neutral-title-1'],
    fontSize: 13,
    fontWeight: '500',
  },
  imageBackground: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'pink',
  },
  image: {
    resizeMode: 'contain',
    width: 100,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gasToSign: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors['neutral-card-2'],
    color: colors['neutral-card-2'],
  },
  gasText: {
    color: colors['neutral-title-1'],
  },
  linearGradient: {
    marginHorizontal: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  linearGradientText: {
    fontSize: 12,
    color: colors['neutral-title-2'],
    cursor: 'pointer',
  },
}));
