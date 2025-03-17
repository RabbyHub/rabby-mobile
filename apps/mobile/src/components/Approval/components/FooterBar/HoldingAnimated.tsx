import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { colord } from 'colord';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  children?: React.ReactNode;
  enable?: boolean;
  width: number;
  height: number;
  duration?: number;
  onStart?: () => void;
  onFinish?: () => void;
  onChange?: (value: number) => void;
}

export const HoldingAnimated: React.FC<Props> = ({
  width,
  height,
  children,
  enable,
  onStart,
  onFinish,
  onChange,
  duration = 1500,
}) => {
  const { styles } = useThemeStyles(getStyles);
  const pressAction = useSharedValue(0);
  const progressStyles = useAnimatedStyle(
    () => ({
      width: interpolate(pressAction.value, [0, 1], [0, width]),
      height,
    }),
    [width, height],
  );

  const handlePressIn = React.useCallback(() => {
    pressAction.value = withTiming(1, { duration });
    onStart?.();
  }, [duration, onStart, pressAction]);

  const handlePressOut = React.useCallback(() => {
    pressAction.value = withTiming(0, {
      duration: (pressAction.value * duration) / 10,
    });
  }, [duration, pressAction]);

  useAnimatedReaction(
    () => pressAction.value,
    (current, prev) => {
      if (current === prev) {
        return;
      }
      if (current === 1) {
        if (onFinish) {
          runOnJS(onFinish)();
        }
      }
      if (onChange) {
        runOnJS(onChange)(current);
      }
    },
  );

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.touchable}
      onPressIn={enable ? handlePressIn : undefined}
      onPressOut={enable ? handlePressOut : undefined}>
      <>
        <Animated.View style={[styles.bgFill, progressStyles]} />
        {children}
      </>
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles(colors => {
  return {
    bgFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      backgroundColor: colord(colors['neutral-black']).alpha(0.2).toHex(),
      zIndex: 1,
    },
    touchable: {
      borderRadius: 8,
      overflow: 'hidden',
    },
  };
});
