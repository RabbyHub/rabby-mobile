import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { trigger } from 'react-native-haptic-feedback';

import StarCC from './icons/star-cc.svg';
import { coerceInteger } from '@/utils/number';

import AnimationStar from './animations/star.json';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { getLottieAnimationDurationInMS } from '@/utils/time';

const STAR_SIZE = 34;

type StarProps = {
  size?: number;
  isFilled?: boolean;
  disableTriggerVibration?: boolean;
  isActive?: boolean;
} & RNViewProps &
  Pick<React.ComponentProps<typeof TouchableOpacity>, 'disabled' | 'onPress'>;

export type PressableStarType = {
  play: LottieView['play'];
  pause: LottieView['reset'];
};

const StarJson = AnimationStar as any;
const MS_PLAY_ONCE = getLottieAnimationDurationInMS(StarJson, {
  frameCountFallback: 60,
  frameRateFallback: 100,
});

function PressableStar({
  isFilled,
  isActive = false,
  disabled = false,
  disableTriggerVibration = false,
  onPress,
  style,
  size: propSize = STAR_SIZE,
}: StarProps) {
  const size = coerceInteger(propSize, STAR_SIZE);
  const { isLight, styles } = useTheme2024({ getStyle: getStyles });

  const staticColor = useMemo(() => {
    if (!isLight) {
      return isFilled ? 'rgba(255, 205, 54, 1)' : 'rgba(255, 255, 255, 0.16)';
    }
    return isFilled ? 'rgba(255, 205, 54, 1)' : 'rgba(0, 0, 0, 0.16)';
  }, [isFilled, isLight]);

  // const animationRef = useRef<LottieView>(null);
  // useEffect(() => {
  //   if (isActive) {
  //     animationRef.current?.play();
  //   } else {
  //     animationRef.current?.reset();
  //     animationRef.current?.pause();
  //   }
  // }, [isActive]);

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={evt => {
        !disableTriggerVibration &&
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        onPress?.(evt);
      }}
      style={style}>
      {isActive ? (
        <View
          pointerEvents="none"
          style={[styles.animationWrapper, { width: size, height: size }]}>
          <LottieView
            // ref={animationRef}
            source={AnimationStar}
            style={StyleSheet.flatten([styles.animationLottie])}
            loop
            duration={MS_PLAY_ONCE}
            autoPlay={isActive}
          />
        </View>
      ) : (
        <StarCC width={size} height={size} color={staticColor} />
      )}
    </TouchableOpacity>
  );
}

const getStyles = createGetStyles2024(({ colors2024 }) => {
  return {
    animationWrapper: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // ...makeDebugBorder('blue'),
    },
    animationLottie: {
      width: '100%',
      height: '100%',
      flex: 1,
    },
  };
});

PressableStar.MS_PLAY_ONCE = MS_PLAY_ONCE;

export default PressableStar;
