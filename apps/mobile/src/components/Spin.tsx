import React, { ReactNode } from 'react';
import SvgIconSpin from '@/assets/icons/common/spin.svg';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

interface SpinProps {
  children?: ReactNode;
  spinning?: boolean;
  size?: 'small' | 'default' | 'large';
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    spin: {
      position: 'relative',
    },
    indicator: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      marginLeft: -12,
      marginTop: -12,
      zIndex: 2,
      color: colors['blue-default'],
    },
    mask: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      backgroundColor: colors['neutral-card-1'],
      opacity: 0.8,
      zIndex: 1,
    },
  });

export const Spin = ({ children, size, spinning = true }: SpinProps) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const indicatorSize = React.useMemo(() => {
    if (size === 'small') {
      return 14;
    }
    if (size === 'default') {
      return 24;
    }
    if (size === 'large') {
      return 40;
    }
    return 24;
  }, [size]);

  const transAnim = React.useRef(new Animated.Value(0));

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(transAnim.current, {
        toValue: 360,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinning]);

  const rotate = transAnim.current.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={StyleSheet.flatten([styles.spin])}>
      {spinning && <View style={styles.mask} />}
      {spinning && (
        <Animated.View
          style={StyleSheet.flatten([
            styles.indicator,
            {
              transform: [
                {
                  rotate,
                },
              ],
            },
          ])}>
          <SvgIconSpin
            style={StyleSheet.flatten([
              styles.indicator,
              {
                width: indicatorSize,
                height: indicatorSize,
              },
            ])}
          />
        </Animated.View>
      )}

      {children}
    </View>
  );
};
