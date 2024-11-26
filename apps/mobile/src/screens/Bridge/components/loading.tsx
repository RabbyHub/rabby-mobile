import React from 'react';
import { Skeleton } from '@rneui/themed';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { Svg, Rect, Circle } from 'react-native-svg';
import { createGetStyles2024 } from '@/utils/styles';
import { useGetBinaryMode, useTheme2024, useThemeColors } from '@/hooks/theme';

const Dots = () => {
  const { styles } = useTheme2024({ getStyle });

  const [dot1] = React.useState(new Animated.Value(0));
  const [dot2] = React.useState(new Animated.Value(0));
  const [dot3] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    const animate = (value, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 750,
            delay,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 750,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 250);
    animate(dot3, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAnimatedStyle = value => ({
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -2, 2],
        }),
      },
    ],
  });

  return (
    <View style={styles.dotsContainer}>
      <Animated.Text style={[styles.dot, getAnimatedStyle(dot1)]}>
        .
      </Animated.Text>
      <Animated.Text style={[styles.dot, getAnimatedStyle(dot2)]}>
        .
      </Animated.Text>
      <Animated.Text style={[styles.dot, getAnimatedStyle(dot3)]}>
        .
      </Animated.Text>
    </View>
  );
};

const SvgComponent = ({ ...props }) => {
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const colors = useThemeColors();
  return (
    <Svg width={325} height={99} viewBox="0 0 325 99" fill="none" {...props}>
      <Rect
        x={17}
        y={9}
        width={292}
        height={66}
        rx={6}
        fill={isDarkTheme ? '#404455' : '#fff'}
        strokeWidth={0.5}
        stroke={colors['neutral-line']}
      />
      <Circle cx={43} cy={34} r={12.5} fill={colors['neutral-card-2']} />
      <Rect
        x={65}
        y={23}
        width={103}
        height={16}
        fill={colors['neutral-card-2']}
      />
      <Rect
        x={190}
        y={23}
        width={103}
        height={16}
        fill={colors['neutral-card-2']}
      />
      <Rect
        x={65}
        y={47}
        width={71}
        height={16}
        fill={colors['neutral-card-2']}
      />
      <Rect
        x={222}
        y={47}
        width={71}
        height={16}
        fill={colors['neutral-card-2']}
      />
    </Svg>
  );
};
export const BestQuoteLoading = () => {
  const [animation] = React.useState(new Animated.Value(0));
  const { styles } = useTheme2024({ getStyle });

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(animation, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
        isInteraction: false,
        delay: 0,
        easing: Easing.in(Easing.linear),
      }),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAnimatedStyle = (index: number) => ({
    zIndex: animation.interpolate({
      inputRange: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1],
      outputRange:
        index === 0
          ? [2, 2, 1, 1, 1, 1, 2, 2]
          : index === 1
          ? [1, 1, 1, 1, 2, 2, 1, 1]
          : [1, 1, 2, 2, 1, 1, 0, 0],
    }),

    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1],
          outputRange:
            index === 0
              ? [0, 0, -44, -44, 40, 40, 0, 0]
              : index === 1
              ? [-44, -44, 40, 40, 0, 0, -44, -44]
              : [40, 40, 0, 0, -44, -44, 40, 40],
        }),
      },
      {
        scale: animation.interpolate({
          inputRange: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1],
          outputRange:
            index === 0
              ? [1, 1, 0.741, 0.741, 0.741, 0.741, 1, 1]
              : index === 1
              ? [0.741, 0.741, 0.741, 0.741, 1, 1, 0.741, 0.741]
              : [0.741, 0.741, 1, 1, 0.741, 0.741, 0.741, 0.741],
        }),
      },
    ],
    opacity: animation.interpolate({
      inputRange: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1],
      outputRange:
        index === 0
          ? [1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1]
          : index === 1
          ? [0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5]
          : [0.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 0.5],
    }),
  });

  return (
    <View style={styles.rootContainer}>
      <View style={styles.svgContainer}>
        {[0, 1, 2].map(index => (
          <Animated.View
            key={index}
            style={[styles.svgItem, getAnimatedStyle(index)]}>
            <SvgComponent style={styles.svgShadow} />
          </Animated.View>
        ))}
      </View>
      <View style={styles.footer}>
        <Image
          source={require('@/assets/images/rabby-chain-logo.png')}
          style={styles.walletImage}
        />
        <Text style={styles.footerText}>Fetching the Best quote</Text>
        <Dots />
      </View>
    </View>
  );
};

export const TokenPairLoading = () => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.container}>
      <View style={styles.tokenInfo}>
        <Skeleton circle width={32} height={32} />
        <Skeleton style={styles.skeletonInput} width={88} height={20} />
      </View>
      <Skeleton style={styles.skeletonInput} width={74} height={20} />
    </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  rootContainer: {
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonInput: {
    borderRadius: 2,
  },

  bestQuoteContainer: {
    alignItems: 'center',
  },
  svgContainer: {
    width: 332,
    height: 166,
    marginHorizontal: 'auto',
    position: 'relative',
  },
  svgItem: {
    position: 'absolute',
    left: 0,
    top: 46,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  svgShadow: {
    shadowColor: 'rgba(0, 0, 0, 0.10)',
    shadowOffset: { width: 0, height: 5.792 },
    shadowOpacity: 1,
    shadowRadius: 11.585,
    elevation: 5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletImage: {
    width: 14,
    height: 14,
  },
  footerText: {
    fontSize: 14,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginLeft: 16,
    position: 'relative',
    top: -6,
    left: -10,
  },
  dot: {
    fontSize: 24,
    color: colors2024['neutral-foot'],
  },

  dexLoading: {
    flexDirection: 'column',
    width: '100%',
    height: 80,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    borderColor: colors2024['neutral-line'],
  },
  column: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dexNameColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeleton3: {
    borderRadius: 2,
    width: 132,
    height: 20,
  },
  skeleton4: {
    borderRadius: 2,
    width: 90,
    height: 16,
  },
}));

export const QuoteLoading = ({}: {}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.dexLoading}>
      <View style={styles.column}>
        <View style={styles.dexNameColumn}>
          <Skeleton circle width={32} height={32} />
          <Skeleton style={styles.skeleton4} />
        </View>
        <Skeleton style={styles.skeleton3} />
      </View>
      <View style={styles.column}>
        <Skeleton style={styles.skeleton4} />
        <Skeleton style={styles.skeleton4} />
      </View>
    </View>
  );
};
