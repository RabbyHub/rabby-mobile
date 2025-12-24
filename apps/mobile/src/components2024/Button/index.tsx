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
  TouchableOpacityProps,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { renderText } from '@/utils/renderNode';
import { createGetStyles2024 } from '@/utils/styles';
import { CircleSpinnerCC } from '../CircleSpinner/CircleSpinnerCC';

export type ButtonProps = Omit<
  TouchableOpacityProps &
    TouchableNativeFeedbackProps & {
      height?: number;
      title?:
        | string
        | ((ctx: { titleStyle?: TextStyle }) => ReactNode)
        | React.ReactElement<{}>;
      titleStyle?: StyleProp<TextStyle>;
      buttonStyle?: StyleProp<ViewStyle> | StyleProp<ViewStyle>[];
      type?: 'primary' | 'ghost' | 'success' | 'danger' | 'warning';
      loading?: boolean;
      loadingStyle?: StyleProp<ViewStyle>;
      containerStyle?: StyleProp<ViewStyle>;
      TouchableComponent?:
        | React.FC<React.ComponentProps<typeof TouchableOpacity>>
        | typeof TouchableNativeFeedback;
      ViewComponent?: typeof React.Component;
      disabled?: boolean;
      disabledTitleStyle?: StyleProp<TextStyle>;
      noShadow?: boolean;
      icon?: ReactNode | ((ctx: { titleStyle?: TextStyle }) => ReactNode);
      iconRight?: ReactNode | ((ctx: { titleStyle?: TextStyle }) => ReactNode);
      showTextOnLoading?: boolean;
      loadingType?: 'indicator' | 'circle';
    },
  'children'
>;

export const Button = ({
  height = undefined,
  title = '',
  titleStyle: passedTitleStyle,
  TouchableComponent = TouchableOpacity,
  containerStyle,
  onPress = () => console.log('Please attach a method to this component'),
  buttonStyle,
  type = 'primary',
  loading = false,
  loadingStyle,
  loadingType = 'indicator',
  noShadow = false,
  disabled = false,
  showTextOnLoading = false,
  disabledTitleStyle,
  icon,
  iconRight,
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
        currentColor: disabled
          ? colors2024['brand-disable']
          : colors2024['brand-default'],
      },
      success: {
        bg: colors2024['green-default'],
        currentColor: colors2024['neutral-InvertHighlight'],
      },
      danger: {
        bg: colors2024['red-default'],
        currentColor: colors2024['neutral-InvertHighlight'],
      },
      warning: {
        bg: colors2024['orange-default'],
        currentColor: colors2024['neutral-InvertHighlight'],
      },
    };
    return {
      currentColor:
        colorMap[type].currentColor || colors2024['neutral-InvertHighlight'],
      bgColor: colorMap[type].bg || colors2024['blue-default'],
    };
  }, [colors2024, disabled, type]);

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
      typeof height === 'number' && styles.titleWithLeading,
      passedTitleStyle,
      disabled && disabledTitleStyle,
    ]);
  }, [
    currentColor,
    styles.title,
    height,
    styles.titleWithLeading,
    passedTitleStyle,
    disabled,
    disabledTitleStyle,
  ]);

  const styleWithHeight = useMemo(
    () => typeof height === 'number' && { height },
    [height],
  );
  const treatAsDisabled = disabled || loading;
  const innerStyle = useMemo(() => {
    return StyleSheet.flatten([
      styles.button,
      styleWithHeight,
      {
        backgroundColor: bgColor,
        borderColor:
          type === 'ghost' ? colors2024['brand-default'] : 'transparent',
        borderWidth: 1,
      },
      type === 'primary' && !noShadow && styles.shadowButton,
      treatAsDisabled &&
        (type === 'ghost'
          ? {
              borderColor: colors2024['brand-disable'],
            }
          : {
              backgroundColor: colors2024['brand-disable'],
            }),
      buttonStyle,
    ]);
  }, [
    treatAsDisabled,
    styles.button,
    styleWithHeight,
    styles.shadowButton,
    bgColor,
    type,
    colors2024,
    buttonStyle,
    noShadow,
  ]);

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

  const iconNode = useMemo(() => {
    const i = icon || iconRight;
    if (typeof i === 'function') {
      return i({ titleStyle });
    }
    return i;
  }, [icon, iconRight, titleStyle]);

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        containerStyle,
        styleWithHeight,
      ])}
      testID="RABBY_BUTTON_WRAPPER">
      <TouchableComponentInternal
        onPress={handleOnPress}
        delayPressIn={0}
        activeOpacity={treatAsDisabled ? 1 : 0.3}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        {...rest}
        style={StyleSheet.flatten([rest.style, styleWithHeight])}>
        <ViewComponent style={innerStyle}>
          {/* Activity Indicator on loading */}
          {loading && (
            <>
              {loadingType === 'indicator' ? (
                <ActivityIndicator
                  style={StyleSheet.flatten([styles.loading, loadingStyle])}
                  color={loadingProps.color}
                  size={loadingProps.size}
                  {...loadingProps}
                />
              ) : (
                <CircleSpinnerCC size={24} style={loadingStyle} />
              )}
              {!!showTextOnLoading &&
                !!textNode &&
                renderText(textNode, {
                  style: titleStyle,
                })}
            </>
          )}
          {!loading && (
            <>
              {iconNode && !iconRight && (
                <View style={StyleSheet.flatten([styles.iconContainer])}>
                  {iconNode}
                </View>
              )}
              {/* Title for Button */}
              {!!textNode &&
                renderText(textNode, {
                  style: titleStyle,
                })}
              {iconNode && iconRight && (
                <View style={StyleSheet.flatten([styles.iconContainer])}>
                  {iconNode}
                </View>
              )}
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
    display: 'flex',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    width: '100%',
    borderRadius: 12,
    height: 56,
  },
  shadowButton: {
    shadowColor: ctx.colors2024['brand-default'],
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    shadowOpacity: 0.1,
    // elevation: 4,
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    paddingVertical: 1,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  titleWithLeading: {
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
