// https://github.com/react-native-elements/react-native-elements/blob/9e26230cdfb90f22b26dc8b7362ef5ac5d5a9f81/packages/base/src/Button/Button.tsx
import React, { useCallback, useMemo, ReactNode } from 'react';
import {
  ActivityIndicator,
  ActivityIndicatorProps,
  Platform,
  StyleProp,
  StyleSheet,
  TextStyle,
  TouchableNativeFeedback,
  TouchableNativeFeedbackProps,
  View,
  ViewStyle,
  TextProps,
  TouchableOpacityProps,
  TouchableOpacity,
} from 'react-native';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { renderText } from '@/utils/renderNode';
import { createGetStyles2024 } from '@/utils/styles';

export type ButtonProps = Omit<
  TouchableOpacityProps &
    TouchableNativeFeedbackProps & {
      title?:
        | string
        | ((ctx: { titleStyle?: TextStyle }) => ReactNode)
        | React.ReactElement<{}>;
      titleStyle?: StyleProp<TextStyle>;
      buttonStyle?: StyleProp<ViewStyle> | StyleProp<ViewStyle>[];
      type?: 'primary' | 'ghost';
      loading?: boolean;
      loadingStyle?: StyleProp<ViewStyle>;
      containerStyle?: StyleProp<ViewStyle>;
      TouchableComponent?: typeof React.Component;
      ViewComponent?: typeof React.Component;
      disabled?: boolean;
    },
  'children'
>;

export const Button = ({
  title = '',
  titleStyle: passedTitleStyle,
  TouchableComponent = TouchableOpacity,
  containerStyle,
  onPress = () => console.log('Please attach a method to this component'),
  buttonStyle,
  type = 'primary',
  loading = false,
  loadingStyle,
  disabled = false,
  ViewComponent = View,
  ...rest
}: ButtonProps) => {
  // const isLight = useGetBinaryMode() === 'light';
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentColor, bgColor } = useMemo(() => {
    const colorMap = {
      primary: {
        bg: colors2024['brand-default'],
        currentColor: colors2024['neutral-InvertHighlight'],
      },
      ghost: {
        bg: colors2024['neutral-bg-1'],
        currentColor: colors2024['brand-default'],
      },
    };
    return {
      currentColor:
        colorMap[type].currentColor || colors2024['neutral-InvertHighlight'],
      bgColor: colorMap[type].bg || colors2024['blue-default'],
    };
  }, [type, colors2024]);

  const handleOnPress = useCallback(
    (evt: any) => {
      if (!loading && !disabled) {
        onPress(evt);
      }
    },
    [disabled, loading, onPress],
  );

  // Refactor to Pressable
  const TouchableComponentInternal =
    TouchableComponent ||
    Platform.select({
      // android: linearGradientProps ? TouchableOpacity : TouchableNativeFeedback,
      // default: TouchableOpacity,????
      android: TouchableNativeFeedback,
      // default: TouchableOpacity,
    });

  const titleStyle: StyleProp<TextStyle> = useMemo(() => {
    return StyleSheet.flatten([
      { color: currentColor },
      styles.title,
      passedTitleStyle,
    ]);
  }, [styles.title, currentColor, passedTitleStyle]);

  const innerStyle = useMemo(() => {
    const isDisabled = disabled;

    return StyleSheet.flatten([
      styles.button,
      {
        backgroundColor: bgColor,
        borderColor:
          type === 'ghost' ? colors2024['brand-default'] : 'transparent',
        borderWidth: 1,
      },
      buttonStyle,
      isDisabled && {
        backgroundColor: colors2024['brand-disable'],
      },
    ]);
  }, [disabled, bgColor, styles.button, buttonStyle, type, colors2024]);

  const loadingProps: ActivityIndicatorProps = {
    color: currentColor,
    size: 'small',
  };

  const accessibilityState = {
    disabled: !!disabled,
    busy: !!loading,
  };

  const textNode = useMemo(() => {
    if (typeof title === 'function') {
      return title({ titleStyle });
    }
    return title;
  }, [title, titleStyle]);

  return (
    <View
      style={StyleSheet.flatten([styles.container, containerStyle])}
      testID="RABBY_BUTTON_WRAPPER">
      {type === 'primary' && <View style={styles.shadowButton} />}
      <TouchableComponentInternal
        onPress={handleOnPress}
        delayPressIn={0}
        activeOpacity={0.3}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        {...rest}
        style={rest.style}>
        <ViewComponent style={innerStyle}>
          {/* Activity Indicator on loading */}
          {loading && (
            <ActivityIndicator
              style={StyleSheet.flatten([styles.loading, loadingStyle])}
              color={loadingProps.color}
              size={loadingProps.size}
              {...loadingProps}
            />
          )}
          {!loading && (
            <>
              {/* {iconNode && !iconRight && (
                <View
                  style={StyleSheet.flatten([
                    styles.iconContainer,
                  ])}>
                  {iconNode}
                </View>
              )} */}
              {/* Title for Button */}
              {!!textNode &&
                renderText(textNode, {
                  style: titleStyle,
                })}
              {/* {iconNode && iconRight && (
                <View
                  style={StyleSheet.flatten([
                    styles.iconContainer,
                  ])}>
                  {iconNode}
                </View>
              )} */}
            </>
          )}
        </ViewComponent>
      </TouchableComponentInternal>
    </View>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  container: {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    gap: 8,
    borderRadius: 100,
  },
  button: {
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    width: '100%',
    // height: '100%',
    height: 56,
  },
  shadowButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    ...Platform.select({
      ios: {
        shadowColor: ctx.colors2024['brand-default'], // 阴影颜色
        shadowOffset: { width: 0, height: 8 }, // 阴影偏移
        shadowOpacity: 0.1, // 阴影透明度
        shadowRadius: 24, // 阴影模糊半径
      },
      android: {
        elevation: 10, // Android 中的阴影效果
      },
    }),
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    paddingVertical: 1,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    lineHeight: 24,
  },
  iconContainer: {
    marginHorizontal: 8,
  },
  loading: {
    marginVertical: 2,
  },
}));

Button.displayName = 'Button';
