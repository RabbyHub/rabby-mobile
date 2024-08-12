import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { default as RcIconGasLight } from '@/assets/icons/sign/tx/gas-light.svg';
import { default as RcIconGasDark } from '@/assets/icons/sign/tx/gas-dark.svg';
import { default as RcIconQuestion } from '@/assets/icons/sign/tx/question-cc.svg';

import { useTranslation } from 'react-i18next';
import { default as RcIconLogo } from '@/assets/icons/sign/tx/rabby.svg';

import { createGetStyles } from '@/utils/styles';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import Svg, { Path } from 'react-native-svg';

import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  TextStyle,
  ViewStyle,
  DimensionValue,
  StyleSheet,
  Pressable,
  Image,
  useWindowDimensions,
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
import { colord } from 'colord';
import { Tip } from '@/components/Tip';

const RcIconGas = makeThemeIcon(RcIconGasLight, RcIconGasDark);

export type GasLessConfig = {
  button_text: string;
  before_click_text: string;
  after_click_text: string;
  logo: string;
  theme_color: string;
  dark_color: string;
};

export function GasLessNotEnough({
  gasLessFailedReason,
}: {
  gasLessFailedReason?: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);

  return (
    <Pressable
      style={[styles.securityLevelTip, { paddingHorizontal: 8 }]}
      onPress={() => setVisible(true)}>
      <View style={styles.tipTriangle} />
      <RcIconGas
        width={16}
        height={16}
        color={colors['neutral-title-1']}
        style={{ marginRight: 4 }}
      />
      <Text style={[styles.text, { marginHorizontal: 4, marginRight: 6 }]}>
        {t('page.signFooterBar.gasless.unavailable')}
      </Text>
      {gasLessFailedReason ? (
        <Tip
          content={gasLessFailedReason}
          isVisible={visible}
          onClose={() => {
            setVisible(false);
          }}>
          <RcIconQuestion
            color={colors['neutral-foot']}
            width={14}
            height={14}
          />
        </Tip>
      ) : null}
    </Pressable>
  );
}

function FreeGasReady({
  freeGasText,
  color,
  logo,
}: {
  freeGasText?: string;
  color?: string;
  logo?: string;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  if (freeGasText) {
    return (
      <View
        style={[
          styles.securityLevelTip,
          {
            position: 'relative',
            backgroundColor: 'transparent',
            paddingTop: 13,
          },
        ]}>
        <ActivityFreeGasBg
          borderColor={color!}
          style={styles.activityFreeGasBg}
        />
        <Image source={{ uri: logo }} style={styles.activityLogo} />
        <Text
          style={{
            color: color,
            fontSize: 13,
            fontWeight: '500',
          }}>
          {freeGasText}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        width: '100%',
        height: 58,
      }}>
      <ImageBackground
        source={require('@/assets/icons/sign/tx/pay-for-gas.png')}
        resizeMode="contain"
        style={{ width: '100%', height: 50, marginTop: 6 }}
      />
    </View>
  );
}

interface ActivityFreeGasBgProps {
  width?: number;
  height?: number;
  trianglePosition?: number;
  borderColor: string;
  borderWidth?: number;
  style?: ViewStyle;
}

const ActivityFreeGasBg: React.FC<ActivityFreeGasBgProps> = ({
  width: propsWidth,
  height = 45,
  trianglePosition = 120,
  borderWidth = 1,
  borderColor,
  style,
}) => {
  const { width: defaultWidth } = useWindowDimensions();

  const width = useMemo(
    () => propsWidth || defaultWidth - 20 * 2,
    [propsWidth, defaultWidth],
  );

  const triangleHeight = 5;

  const outerWidth = useMemo(
    () => width + borderWidth * 2,
    [width, borderWidth],
  );
  const outerHeight = useMemo(
    () => height + borderWidth * 2,
    [height, borderWidth],
  );

  const pathData = useMemo(
    () => `
    M${trianglePosition + 5} ${triangleHeight + borderWidth}
    H${outerWidth - 6 - borderWidth}
    C${outerWidth - 3 - borderWidth} ${triangleHeight + borderWidth} ${
      outerWidth - borderWidth
    } ${triangleHeight + 3 + borderWidth} ${outerWidth - borderWidth} ${
      triangleHeight + 6 + borderWidth
    }
    V${outerHeight - 6 - borderWidth}
    C${outerWidth - borderWidth} ${outerHeight - 3 - borderWidth} ${
      outerWidth - 3 - borderWidth
    } ${outerHeight - borderWidth} ${outerWidth - 6 - borderWidth} ${
      outerHeight - borderWidth
    }
    H${6 + borderWidth}
    C${3 + borderWidth} ${outerHeight - borderWidth} ${borderWidth} ${
      outerHeight - 3 - borderWidth
    } ${borderWidth} ${outerHeight - 6 - borderWidth}
    V${triangleHeight + 6 + borderWidth}
    C${borderWidth} ${triangleHeight + 3 + borderWidth} ${3 + borderWidth} ${
      triangleHeight + borderWidth
    } ${6 + borderWidth} ${triangleHeight + borderWidth}
    H${trianglePosition - 5}
    L${trianglePosition} ${borderWidth}
    L${trianglePosition + 5} ${triangleHeight + borderWidth}
    Z
  `,
    [trianglePosition, borderWidth, outerWidth, outerHeight],
  );

  return (
    <Svg
      style={style}
      width={outerWidth}
      height={outerHeight}
      viewBox={`0 0 ${outerWidth} ${outerHeight}`}
      fill="none">
      <Path d={pathData} stroke={borderColor} />
    </Svg>
  );
};

export function GasLessActivityToSign({
  handleFreeGas,
  gasLessEnable,
  gasLessConfig,
}: {
  handleFreeGas: () => void;
  gasLessEnable: boolean;
  gasLessConfig?: GasLessConfig;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isLight = useGetBinaryMode() === 'light';

  const themeColor = !isLight
    ? gasLessConfig?.dark_color
    : gasLessConfig?.theme_color;

  const hiddenAnimated = useSharedValue(0);

  const toSignStyle = useAnimatedStyle(() => ({
    display: hiddenAnimated.value !== 1 ? 'flex' : 'none',
  }));

  const confirmedStyled = useAnimatedStyle(() => ({
    display: hiddenAnimated.value === 1 ? 'flex' : 'none',
  }));

  const [animated, setAnimated] = useState(false);

  const startAnimation = React.useCallback(() => {
    setAnimated(true);
    handleFreeGas();
    hiddenAnimated.value = withDelay(
      900,
      withTiming(1, {
        duration: 0,
      }),
    );
  }, [hiddenAnimated, handleFreeGas]);

  const isActivityFreeGas = React.useMemo(() => {
    return !!gasLessConfig && !!gasLessConfig?.button_text;
  }, [gasLessConfig]);

  if (gasLessEnable && !animated) {
    return (
      <FreeGasReady
        freeGasText={gasLessConfig?.after_click_text}
        color={themeColor}
        logo={gasLessConfig?.logo}
      />
    );
  }

  return (
    <>
      <Animated.View style={toSignStyle}>
        <View
          style={[
            styles.securityLevelTip,

            isActivityFreeGas
              ? {
                  backgroundColor: 'transparent',
                }
              : {},
          ]}>
          {isActivityFreeGas ? (
            <ActivityFreeGasBg
              borderColor={themeColor!}
              style={styles.activityFreeGasBg}
            />
          ) : (
            <View style={styles.tipTriangle} />
          )}
          {isActivityFreeGas ? (
            <Image
              source={{ uri: gasLessConfig?.logo }}
              style={styles.activityLogo}
            />
          ) : (
            <RcIconGas
              width={16}
              height={16}
              color={colors['neutral-title-1']}
              style={{ marginRight: 4 }}
            />
          )}
          <Text
            style={[
              styles.text,
              styles.gasText,
              isActivityFreeGas && {
                color: themeColor,
              },
            ]}>
            {gasLessConfig?.before_click_text ||
              t('page.signFooterBar.gasless.notEnough')}
          </Text>
          <TouchableOpacity onPress={startAnimation}>
            {isActivityFreeGas ? (
              <View
                style={[
                  styles.linearGradient,
                  {
                    backgroundColor: themeColor,
                  },
                ]}>
                <Text style={styles.linearGradientText}>
                  {gasLessConfig?.button_text}
                </Text>
              </View>
            ) : (
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
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
      <Animated.View style={confirmedStyled}>
        <FreeGasReady
          freeGasText={gasLessConfig?.after_click_text}
          color={themeColor}
          logo={gasLessConfig?.logo}
        />
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
    gasLessThemeColor?: string;
    isGasNotEnough?: boolean;
  }>,
) => {
  const colors = useThemeColors();

  const logoXValue = useSharedValue(-10);

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
      left: (interpolate(logoXValue.value, [-10, 100], [-10, 100]) +
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
      left: (interpolate(logoXValue.value, [-10, 100], [-210, -100]) +
        '%') as DimensionValue,
    }),
    [props?.gasLessThemeColor],
  );

  const processBgColor = useMemo(
    () => colord(colors['blue-default']).alpha(0.5).toRgbString(),
    [colors],
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
            bgStyle,
          ]}>
          <Animated.View style={blueBgStyle} />

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
    left: '33%',
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
    alignItems: 'center',
  },

  activityFreeGasBg: {
    position: 'absolute',
    left: 0,
    top: -5,
  },
  activityLogo: {
    width: 16,
    height: 16,
    marginRight: 4,
  },

  text: {
    color: colors['neutral-title-1'],
    fontSize: 12,
    fontWeight: '500',
  },
  imageBackground: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 100,
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
    flex: 1,
    color: colors['neutral-title-1'],
  },
  linearGradient: {
    marginHorizontal: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  linearGradientText: {
    fontSize: 11,
    color: colors['neutral-title-2'],
  },
}));
