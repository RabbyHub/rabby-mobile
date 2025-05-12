import React, { ReactNode } from 'react';
import SvgIconSpin from '@/assets/icons/common/spin.svg';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

interface SpinProps {
  children?: ReactNode;
  spinning?: boolean;
  size?: 'small' | 'default' | 'large';
  hasMask?: boolean;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    spin: {
      position: 'relative',
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
    indicatorWrapper: {
      position: 'absolute',
      zIndex: 2,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const Spin = ({
  children,
  size,
  spinning = true,
  hasMask = true,
}: SpinProps) => {
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
      {spinning && hasMask && <View style={styles.mask} />}
      {spinning && (
        <View style={styles.indicatorWrapper}>
          <Animated.View
            style={{
              transform: [
                {
                  rotate,
                },
              ],
            }}>
            <SvgIconSpin
              color={colors['blue-default']}
              width={indicatorSize}
              height={indicatorSize}
              style={{ width: indicatorSize, height: indicatorSize }}
            />
          </Animated.View>
        </View>
      )}

      {children}
    </View>
  );
};
