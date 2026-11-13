// ((props: TabItemProps<T>) => React.ReactNode);
import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, { clamp, useAnimatedStyle } from 'react-native-reanimated';
import { StyleSheet, TextProps } from 'react-native';
import { ThemeColors2024 } from '@rabby-wallet/base-utils';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { Text } from '@/components/Typography';

interface CustomLabelProps {
  index: number;
  indexDecimal: Animated.SharedValue<number>;
  icon?: React.ReactNode;
  text: string;
  activeColor?: string;
  inactiveColor?: string;
  activeFontWeight?: string;
  inactiveFontWeight?: string;
  activeFontSize?: number;
  inactiveFontSize?: number;
  style?: TextProps['style'];
}

/**
 * One tab label: a pill that fades in with the swipe and two stacked texts.
 *
 * The weight is `1 - |index - track|`, so dragging between two tabs hands the
 * highlight over gradually ("swipe half way, each of them is half lit") instead
 * of flipping at the midpoint. Only `opacity` is animated: the text colour is
 * two static layers, because writing `color` from a worklet re-publishes a text
 * prop on the shadow tree every frame, which is what makes Fabric commits
 * expensive here.
 */
const CustomLabel = ({
  index,
  indexDecimal,
  text,
  style,
}: CustomLabelProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const pillStyle = useAnimatedStyle(() => {
    const weight = clamp(1 - Math.abs(index - indexDecimal.value), 0, 1);
    // Ease it so the pill only shows up close to its own tab.
    return { opacity: weight * weight * (3 - 2 * weight) };
  });
  const activeTextStyle = useAnimatedStyle(() => {
    return {
      opacity: clamp(1 - Math.abs(index - indexDecimal.value), 0, 1),
    };
  });

  return (
    <Animated.View style={styles.container}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <Animated.View style={styles.labelStack}>
        <Text style={[styles.label, styles.labelInactive, style]}>{text}</Text>
        <Animated.Text
          style={[styles.label, styles.labelActive, style, activeTextStyle]}>
          {text}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
};

export default CustomLabel;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: HOME_TOP_HEADER_SIZES.headerTabItemHeight,
    width: 70,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: isLight
      ? ThemeColors2024.dark['neutral-bg-1']
      : colors2024['neutral-bg-1'],
  },
  labelStack: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textTransform: 'none',
    textAlign: 'center',
  },
  labelInactive: {
    color: colors2024['neutral-secondary'],
  },
  labelActive: {
    ...StyleSheet.absoluteFillObject,
    color: isLight
      ? ThemeColors2024.dark['neutral-title-1']
      : ThemeColors2024.light['neutral-title-1'],
  },
}));
