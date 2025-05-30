import { default as RcIconGasDark } from '@/assets/icons/sign/tx/gas-dark.svg';
import { default as RcIconGasLight } from '@/assets/icons/sign/tx/gas-light.svg';
import React, { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Svg, { Path } from 'react-native-svg';

import { makeThemeIcon } from '@/hooks/makeThemeIcon';
import {
  Image,
  ImageBackground,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ThemeColors2024 } from '@/constant/theme';

const RcIconGas = makeThemeIcon(RcIconGasLight, RcIconGasDark);

export type GasLessConfig = {
  button_text: string;
  before_click_text: string;
  after_click_text: string;
  logo: string;
  theme_color: string;
  dark_color: string;
};

function FreeGasReady({
  freeGasText,
  color,
  logo,
  isColorDefined,
}: {
  freeGasText?: string;
  color?: string;
  logo?: string;
  isColorDefined?: boolean;
}) {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  if (freeGasText) {
    return (
      <View
        style={[
          styles.securityLevelTip,
          {
            position: 'relative',
            backgroundColor: 'transparent',
          },
        ]}>
        <ActivityFreeGasBg
          borderColor={isColorDefined ? color! : colors2024['brand-light-1']}
          style={styles.activityFreeGasBg}
          backgroundColor={
            isColorDefined ? undefined : colors2024['brand-light-1']
          }
          height={39}
        />
        <Image source={{ uri: logo }} style={styles.activityLogo} />
        <Text
          style={[
            styles.freeReadyText,
            {
              color: isColorDefined ? color : colors2024['brand-default'],
            },
          ]}>
          {freeGasText}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        width: '100%',
        height: 46,
        marginTop: -5,
        marginBottom: 7,
      }}>
      <ImageBackground
        source={require('@/assets/icons/sign/tx/pay-for-gas-1.png')}
        resizeMode="contain"
        style={{ width: '100%', height: 46, marginTop: 0 }}
      />
    </View>
  );
}

interface ActivityFreeGasBgProps {
  width?: number;
  height?: number;
  borderColor: string;
  backgroundColor?: string;
  borderWidth?: number;
  style?: ViewStyle;
  position?: 'left' | 'right';
}

const ActivityFreeGasBg: React.FC<ActivityFreeGasBgProps> = ({
  width: propsWidth,
  height = 45,
  borderWidth = 1,
  borderColor,
  style,
  backgroundColor = 'none',
  position = 'right',
}) => {
  const { width: defaultWidth } = useWindowDimensions();

  // const trianglePosition = useMemo(() => {
  //   return (defaultWidth - 20 * 2) * (0.25 * (position === 'left' ? 1 : 3));
  // }, [defaultWidth, position]);

  const trianglePosition = useMemo(() => {
    return 18;
  }, []);

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
      fill={backgroundColor}>
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
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });

  const themeColor = gasLessConfig
    ? (!isLight ? gasLessConfig?.dark_color : gasLessConfig?.theme_color) ||
      colors2024['brand-default']
    : undefined;

  const isColorDefined = Boolean(
    !isLight ? gasLessConfig?.dark_color : gasLessConfig?.theme_color,
  );

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
        isColorDefined={isColorDefined}
        // backgroundColor={colors2024['brand-light-1']}
      />
    );
  }

  return (
    <>
      <Animated.View style={toSignStyle}>
        <View
          style={[
            styles.securityLevelTip,

            isActivityFreeGas && isColorDefined
              ? {
                  backgroundColor: 'transparent',
                }
              : {
                  backgroundColor: colors2024['red-light-1'],
                },
          ]}>
          {isActivityFreeGas && isColorDefined ? (
            <ActivityFreeGasBg
              borderColor={themeColor!}
              // backgroundColor={colors2024['brand-light-1']}
              style={styles.activityFreeGasBg}
              height={39}
            />
          ) : (
            <View style={styles.tipTriangle} />
          )}
          {isActivityFreeGas && gasLessConfig?.logo ? (
            <Image
              source={{ uri: gasLessConfig?.logo }}
              style={styles.activityLogo}
            />
          ) : null}
          <Text
            style={[
              styles.text,
              styles.gasText,
              isActivityFreeGas &&
                isColorDefined && {
                  color: themeColor,
                },
            ]}>
            {gasLessConfig?.before_click_text ||
              t('page.signFooterBar.gasless.notEnough')}
          </Text>
          <TouchableOpacity onPress={startAnimation}>
            {isActivityFreeGas && isColorDefined ? (
              <View
                style={[
                  styles.gasAccountBtn,
                  {
                    backgroundColor: themeColor,
                  },
                ]}>
                <Text style={styles.linearGradientText}>
                  {gasLessConfig?.button_text}
                </Text>
              </View>
            ) : (
              <View style={styles.gasAccountBtn}>
                <Text style={styles.gasAccountTipBtnText}>
                  {gasLessConfig?.button_text ||
                    t('page.signFooterBar.gasless.GetFreeGasToSign')}
                </Text>
              </View>
              // <LinearGradient
              //   colors={['#60bcff', '#8154ff']}
              //   locations={[0.1447, 0.9383]}
              //   useAngle
              //   angle={94}
              //   style={styles.linearGradient}>
              //   <Text style={styles.linearGradientText}>
              //     {t('page.signFooterBar.gasless.GetFreeGasToSign')}
              //   </Text>
              // </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
      <Animated.View style={confirmedStyled}>
        <FreeGasReady
          freeGasText={gasLessConfig?.after_click_text}
          color={themeColor}
          logo={gasLessConfig?.logo}
          isColorDefined={isColorDefined}
        />
      </Animated.View>
    </>
  );
}

const getStyle = createGetStyles2024(({ colors, colors2024, isLight }) => ({
  securityLevelTip: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-4'],
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 5,
    borderRadius: 8,
    position: 'relative',
    marginBottom: 8,
    marginTop: 5,
    minHeight: 36,
  },
  tipTriangle: {
    position: 'absolute',
    top: -20,
    left: 10,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: colors2024['red-light-1'],
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
    marginRight: 8,
  },

  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-body'],
    lineHeight: 18,
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
    color: colors2024['red-default'],
  },
  linearGradient: {
    marginHorizontal: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  linearGradientText: {
    color: colors['neutral-title-2'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 16,
  },
  gasAccountBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
    height: 28,
    backgroundColor: colors2024['brand-default'],
    borderRadius: 6,
    marginLeft: 'auto',
    paddingHorizontal: 12,
  },
  gasAccountTipBtnText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '700',
    color: isLight
      ? ThemeColors2024.dark['neutral-title-1']
      : ThemeColors2024.light['neutral-title-1'],
    lineHeight: 16,
  },

  // freeReadyContainer: {
  //   backgroundColor: colors2024['brand-light-1'],
  //   borderRadius: 8,
  //   paddingVertical: 8,
  //   paddingLeft: 12,
  //   paddingRight: 5,

  //   display: 'flex',
  //   flexDirection: 'row',
  //   alignItems: 'center',

  //   borderColor: colors2024['brand-light-1'],
  //   borderWidth: 1,
  // },
  // freeReadyTriangle: {},
  freeReadyText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
