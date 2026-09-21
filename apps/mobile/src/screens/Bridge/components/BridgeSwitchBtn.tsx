import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import RcIconSwitchBtn from '@/assets2024/icons/bridge/IconSwitchBtnNew.svg';
import RcIconSwitchBtnDark from '@/assets2024/icons/bridge/IconSwitchBtnNewDark.svg';
import SwapLoadingPng from '@/assets2024/images/swap/loading.png';
import { useTheme2024 } from '@/hooks/theme';
import Reanimated, {
  cancelAnimation,
  Easing as ReanimatedEasing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

const BUTTON_SIZE = 36;
const PROGRESS_STROKE_WIDTH = 3;
const PROGRESS_RADIUS = (BUTTON_SIZE - PROGRESS_STROKE_WIDTH) / 2;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;
const SWAP_LOADING_COLOR = '#7084FF';
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

interface BridgeSwitchBtnProps extends TouchableOpacityProps {
  onPress?: (event?: GestureResponderEvent) => void;
  loading?: boolean;
  refreshCountdown?: {
    startedAt: number;
    deadline: number;
  } | null;
}

const BridgeSwitchBtn: FC<BridgeSwitchBtnProps> = ({
  onPress,
  loading,
  refreshCountdown,
  style,
  ...others
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const { colors2024, isLight } = useTheme2024();

  const handlePressIn = () => {
    setIsPressed(true);
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[styles.button, style]}
      {...others}>
      {isLight ? (
        <RcIconSwitchBtn
          width={BUTTON_SIZE}
          height={BUTTON_SIZE}
          color={colors2024['neutral-bg-3']}
        />
      ) : (
        <RcIconSwitchBtnDark
          width={BUTTON_SIZE}
          height={BUTTON_SIZE}
          color={colors2024['neutral-bg-3']}
        />
      )}

      {!loading && refreshCountdown && (
        <QuoteRefreshProgress {...refreshCountdown} />
      )}
      {loading && <Loading />}
    </TouchableOpacity>
  );
};

function QuoteRefreshProgress({
  startedAt,
  deadline,
}: {
  startedAt: number;
  deadline: number;
}) {
  const progress = useSharedValue(0);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: -PROGRESS_CIRCUMFERENCE * progress.value,
  }));

  useEffect(() => {
    cancelAnimation(progress);

    const duration = deadline - startedAt;
    const remaining = Math.max(deadline - Date.now(), 0);
    progress.value =
      duration > 0 ? Math.min(Math.max(1 - remaining / duration, 0), 1) : 0;

    if (remaining > 0) {
      progress.value = withTiming(1, {
        duration: remaining,
        easing: ReanimatedEasing.linear,
      });
    }

    return () => {
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [deadline, progress, startedAt]);

  return (
    <Svg
      pointerEvents="none"
      width={BUTTON_SIZE}
      height={BUTTON_SIZE}
      style={styles.progressRing}>
      <G rotation="-90" origin={`${BUTTON_SIZE / 2}, ${BUTTON_SIZE / 2}`}>
        <AnimatedCircle
          animatedProps={animatedProps}
          cx={BUTTON_SIZE / 2}
          cy={BUTTON_SIZE / 2}
          r={PROGRESS_RADIUS}
          fill="none"
          stroke={SWAP_LOADING_COLOR}
          strokeWidth={PROGRESS_STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={PROGRESS_CIRCUMFERENCE}
        />
      </G>
    </Svg>
  );
}

// todo move to components fold
export function Loading() {
  const rotateValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  const rotate = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]);
    animation.start();

    return () => {
      animation.stop();
      opacityValue.setValue(0);
      rotateValue.setValue(0);
    };
  }, [opacityValue, rotateValue]);

  const animatedStyle = useMemo(
    () => ({
      opacity: opacityValue,
      transform: [{ rotate: rotate }],
    }),
    [opacityValue, rotate],
  );

  return (
    <Animated.Image
      source={SwapLoadingPng}
      style={[
        animatedStyle,
        {
          width: '100%',
          height: '100%',
          position: 'absolute',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  progressRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  swapButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BridgeSwitchBtn;
