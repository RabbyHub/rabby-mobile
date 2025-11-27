// @see file:///./../../../../node_modules/react-native-collapsible-tab-view/src/MaterialTabBar/TabItem.tsx
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Pressable, Platform, PressableProps } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { MaterialTabItemProps } from 'react-native-collapsible-tab-view';
import {
  RNGHPressable,
  RNGHPressableProps,
  RNGHTouchableOpacity,
  RNGHTouchableOpacityProps,
} from '@/components/customized/reexports';
import { useMemoizedFn } from 'ahooks';

export type PatchedTabItemProps<T extends string> = Omit<
  MaterialTabItemProps<T>,
  keyof PressableProps
> &
  Omit<PressableProps, 'onPress' | 'children'> & {
    onSwitchTo?: (name: T) => void;
  };

export const TABBAR_HEIGHT = 48;
const DEFAULT_COLOR = 'rgba(0, 0, 0, 1)';

/**
 * Any additional props are passed to the pressable component.
 */
export const PatchedTabItem = <T extends string = string>(
  props: PatchedTabItemProps<T>,
): React.ReactElement => {
  const {
    name,
    index,
    onSwitchTo,
    onLayout,
    scrollEnabled,
    indexDecimal,
    label,
    style,
    labelStyle,
    activeColor = DEFAULT_COLOR,
    inactiveColor = DEFAULT_COLOR,
    inactiveOpacity = 0.7,
    pressColor = '#DDDDDD',
    pressOpacity = Platform.OS === 'ios' ? 0.2 : 1,
    ...rest
  } = props;

  const stylez = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        indexDecimal.value,
        [index - 1, index, index + 1],
        [inactiveOpacity, 1, inactiveOpacity],
        Extrapolation.CLAMP,
      ),
      color:
        Math.abs(index - indexDecimal.value) < 0.5
          ? activeColor
          : inactiveColor,
    };
  });

  const renderedLabel = useMemo(() => {
    if (typeof label === 'string') {
      return (
        <Animated.Text style={[styles.label, stylez, labelStyle]}>
          {label}
        </Animated.Text>
      );
    }

    return label(props);
  }, [label, labelStyle, props, stylez]);

  const memoziedStyleFn = useMemoizedFn(
    typeof style === 'function' ? style : () => style,
  );
  const styleFn = useCallback<RNGHPressableProps['style'] & Function>(
    ({ pressed }) => {
      return [
        { opacity: pressed ? pressOpacity : 1 },
        !scrollEnabled && styles.grow,
        styles.item,
        memoziedStyleFn({ pressed }),
      ];
    },
    [pressOpacity, scrollEnabled, memoziedStyleFn],
  );

  return (
    <Pressable
      onLayout={onLayout}
      style={styleFn}
      onPressIn={() => onSwitchTo?.(name)}
      android_ripple={null}
      {...rest}>
      {renderedLabel}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: TABBAR_HEIGHT,
  },
  label: {
    margin: 4,
  },
});
