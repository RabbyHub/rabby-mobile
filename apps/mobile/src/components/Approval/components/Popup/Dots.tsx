import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
    },
    dot: {
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
    },
  });

const bounceHeight = 5;

export const Dots: React.FC<{
  color?: keyof AppColorsVariants;
  style?: StyleProp<TextStyle>;
}> = ({ color, style }) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [animations, setAnimations] = useState<Animated.Value[]>([]);
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    const dotAnimations: Animated.Value[] = [];
    let animationsAmount = 3;
    for (let i = 0; i < animationsAmount; i++) {
      dotAnimations.push(new Animated.Value(0));
    }
    setAnimations(dotAnimations);
  }, []);

  useEffect(() => {
    if (animations.length === 0) {
      return;
    }
    loadingAnimation(animations, reverse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animations]);

  function floatAnimation(node, reverseY, delay) {
    const floatSequence = Animated.sequence([
      Animated.timing(node, {
        toValue: reverseY ? 0 : -bounceHeight,
        easing: Easing.bezier(0.41, -0.15, 0.56, 1.21),
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(node, {
        toValue: reverseY ? -bounceHeight : 0,
        easing: Easing.bezier(0.41, -0.15, 0.56, 1.21),
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(node, {
        toValue: 0,
        delay,
        useNativeDriver: true,
      }),
    ]);
    return floatSequence;
  }

  function loadingAnimation(nodes, reverseY) {
    Animated.parallel(
      nodes.map((node, index) => floatAnimation(node, reverseY, index * 100)),
    ).start(() => {
      setReverse(!reverse);
    });
  }

  useEffect(() => {
    if (animations.length === 0) {
      return;
    }
    loadingAnimation(animations, reverse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reverse, animations]);

  return (
    <View style={styles.wrapper}>
      {animations.map((animation, index) => (
        <Animated.View
          key={`loading-anim-${index}`}
          style={{ transform: [{ translateY: animation }] }}>
          <Text
            style={[
              styles.dot,
              {
                // @ts-expect-error
                color: colors[color],
              },
              style,
            ]}>
            .
          </Text>
        </Animated.View>
      ))}
    </View>
  );
};
