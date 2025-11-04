import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useRef, useEffect, ReactNode } from 'react';
import {
  View,
  Animated as RNAnimated,
  Easing as RNEasing,
  StyleSheet,
  Dimensions,
} from 'react-native';
import RNLinearGradient from 'react-native-linear-gradient';

import {
  Canvas,
  Rect,
  SweepGradient,
  vec,
  point,
  Transforms3d,
  AnimatedProp,
  BackdropBlur,
  Fill,
  translate,
  Group,
  LinearGradient,
  Blur,
} from '@shopify/react-native-skia';
import { stringUtils } from '@rabby-wallet/base-utils';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from '@react-native-community/blur';

function ConicViewSample() {
  // web css animation: spin 4s linear infinite running;
  const { colors } = useTheme2024();
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }), // Animates to 360 degrees
      0, // 0 means infinite repeats
      true, // Reverse: false means it restarts from 0 after each cycle
    );

    return () => {
      'worklet';
      cancelAnimation(rotation);
    };
  }, [rotation]);
  const rotationTransform = useDerivedValue(() => {
    return [
      {
        rotate: rotation.value * 2,
      },
    ];
  });

  const sizes = {
    width: Dimensions.get('window').width - 20 * 2,
    height: 100,
  };

  return (
    <View
      style={[
        {
          width: sizes.width,
          height: sizes.height,
          borderWidth: 4,
          // borderColor: '#FFFFFF',
          // borderColor: 'rgba(255, 255, 255, 0.5)',
          borderColor: 'transparent',
          borderStyle: 'solid',
          borderRadius: 20,
          marginHorizontal: 'auto',
          // overflow: 'hidden',
          inset: -20 /* -borderRadius */,
        },
      ]}>
      <RNLinearGradient
        style={[
          {
            position: 'relative',
            flex: 1,
            borderRadius: 20,
            width: '100%',
            height: '100%',
            // filter: 'blur(20px)',
            // backgroundColor: 'linear-gradient(black, black)'
          },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        // colors={['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.7)']}>
        colors={['rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 1)']}>
        <RNAnimated.View
          style={[
            {
              width: '100%',
              height: '100%',
              borderRadius: 20,
            },
          ]}>
          <Canvas
            style={[
              {
                width: '100%',
                height: '100%',
                borderRadius: 20,
              },
            ]}>
            <Rect
              origin={vec((Dimensions.get('window').width - 20 * 2) / 2, 50)}
              width={sizes.width}
              height={999}
              color="white">
              <Blur blur={20} />
            </Rect>
            <Group
              color="lightblue"
              transform={rotationTransform}
              origin={vec((Dimensions.get('window').width - 20 * 2) / 2, 50)}>
              <Rect
                x={0}
                y={0}
                width={sizes.width}
                height={sizes.height}
                color="lightblue">
                {/* <LinearGradient
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  colors={[
                    'rgba(0, 0, 0, 0.1)',
                    'rgba(0, 0, 0, 0.7)',
                  ]} /> */}
                <SweepGradient
                  mode="repeat"
                  colors={[
                    '#EEEBFF',
                    '#A193F6',
                    '#3DFCFF',
                    '#FF7DD6',
                    '#EEEBFF',
                  ]}
                  c={vec((Dimensions.get('window').width - 20 * 2) / 2, 50)} // Center of the gradient
                  // c={point(0, 0)} // Center of the gradient
                  start={0}
                  end={360}
                />
              </Rect>
            </Group>
          </Canvas>
        </RNAnimated.View>
      </RNLinearGradient>
    </View>
  );
}

export type AnimatedBorderViewProps = {
  width?: number;
  height?: number;
  borderRadius?: number;
  sliderWidth?: number;
  sliderHeight?: number;
  delayInAnimation?: number;
  pathColor?: string;
  sliderColor?: string;
  innerContainerColor?: string;
  children?: ReactNode;
} & RNViewProps;

const AnimatedBorderView: React.FC<AnimatedBorderViewProps> = ({
  style,
  width = 180,
  height = 50,
  borderRadius = 50,
  sliderWidth = 80,
  sliderHeight = 5,
  delayInAnimation = 3000, // Total duration in milliseconds for one full loop, adjust as needed
  pathColor = '#FFFFFF',
  sliderColor = '#FFDA47',
  innerContainerColor = '#854CF0',
  children,
}) => {
  const isCircle = width === height && borderRadius >= width / 2;
  const diagonal = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
  const animatedValue = useRef(new RNAnimated.Value(0)).current;

  const { styles } = useTheme2024({ getStyle });

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.timing(animatedValue, {
        toValue: 1,
        duration: delayInAnimation,
        easing: Easing.linear, // Use linear easing for smooth animation
        useNativeDriver: true,
      }),
    ).start();
  }, [animatedValue, delayInAnimation]);

  const translateXInterpolation = animatedValue.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: isCircle
      ? [0, 0, 0, 0, 0] // No movement for circle, only rotate
      : [
          -width / 2 + borderRadius, // Start from the left
          width / 2 - borderRadius, // Move to the right
          width / 2 - borderRadius, // Stay at the right edge
          -width / 2 + borderRadius, // Move back to the left edge
          -width / 2 + borderRadius, // Repeat the cycle
        ],
  });

  const rotateInterpolation = animatedValue.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['0deg', '90deg', '180deg', '270deg', '360deg'],
  });

  return (
    <View
      style={[
        styles.pathContainer,
        { width, height, borderRadius, backgroundColor: pathColor },
        style,
      ]}>
      <RNAnimated.View
        style={[
          styles.animatedView,
          {
            transform: [
              { translateX: translateXInterpolation },
              { rotate: rotateInterpolation },
            ],
            height: diagonal,
            width: sliderWidth,
          },
        ]}>
        <RNLinearGradient
          colors={[
            `${sliderColor}02`,
            `${sliderColor}60`,
            sliderColor,
            `${sliderColor}60`,
            `${sliderColor}02`,
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
        <View style={{ flex: 1, backgroundColor: pathColor }}></View>
      </RNAnimated.View>
      <View
        style={[
          styles.innerContainer,
          {
            borderRadius: borderRadius - 2,
            margin: sliderHeight,
            backgroundColor: innerContainerColor,
          },
        ]}>
        {children}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  pathContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  animatedView: {
    position: 'absolute',
  },
  innerContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#854CF0',
    overflow: 'hidden',
  },
}));

export default AnimatedBorderView;
