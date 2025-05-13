// https://github.com/react-native-elements/react-native-elements/blob/9e26230cdfb90f22b26dc8b7362ef5ac5d5a9f81/packages/base/src/Button/Button.tsx
import React, { useCallback, useEffect, useMemo, ReactNode } from 'react';
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

import { useThemeColors, useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { renderText } from '@/utils/renderNode';
import { createGetStyles2024 } from '@/utils/styles';

export type ButtonProps = TouchableOpacityProps &
  TouchableNativeFeedbackProps & {
    title?:
      | string
      | ((ctx: { titleStyle?: TextStyle }) => ReactNode)
      | React.ReactElement<{}>;
    titleStyle?: StyleProp<TextStyle>;
    titleProps?: TextProps;
    buttonStyle?: StyleProp<ViewStyle> | StyleProp<ViewStyle>[];
    type?: 'primary' | 'white' | 'clear' | 'danger' | 'success';
    loading?: boolean;
    showTitleOnLoading?: boolean;
    loadingStyle?: StyleProp<ViewStyle>;
    loadingProps?: ActivityIndicatorProps;
    containerStyle?: StyleProp<ViewStyle>;
    height?: number;
    linearGradientProps?: object;
    TouchableComponent?: typeof React.Component;
    ViewComponent?: typeof React.Component;
    disabled?: boolean;
    disabledStyle?: StyleProp<ViewStyle>;
    disabledTitleStyle?: StyleProp<TextStyle>;
    ghost?: boolean;
    iconRight?: boolean;
    icon?: ReactNode | ((ctx: { titleStyle?: TextStyle }) => ReactNode);
    iconContainerStyle?: StyleProp<ViewStyle>;
  };

export const Button = ({
  title = '',
  titleStyle: passedTitleStyle,
  titleProps,
  TouchableComponent,
  containerStyle,
  height,
  onPress = () => console.log('Please attach a method to this component'),
  buttonStyle,
  type = 'primary',
  ghost,
  loading = false,
  showTitleOnLoading = false,
  loadingStyle,
  loadingProps: passedLoadingProps,
  icon,
  iconRight,
  iconContainerStyle,
  disabled = false,
  disabledTitleStyle,
  linearGradientProps,
  disabledStyle,
  ViewComponent = View,
  ...rest
}: ButtonProps) => {
  const isLight = useGetBinaryMode() === 'light';
  const colors = useThemeColors();
  const isClearType = useMemo(() => type === 'clear', [type]);

  const { currentColor, bgColor } = useMemo(() => {
    const colorMap = {
      primary: {
        bg: !ghost ? colors['blue-default'] : colors['neutral-bg1'],
        currentColor: !ghost
          ? colors['neutral-title2']
          : colors['blue-default'],
      },
      white: {
        currentColor: colors['blue-default'],
        bg: colors['neutral-bg1'],
      },
      clear: { currentColor: 'black', bg: 'transparent' },
      danger: {
        currentColor: colors['neutral-title2'],
        bg: colors['red-default'],
      },
      success: {
        currentColor: colors['neutral-title2'],
        bg: colors['green-default'],
      },
    };
    return {
      currentColor: colorMap[type].currentColor || colors['neutral-title2'],
      bgColor: colorMap[type].bg || colors['blue-default'],
    };
  }, [type, colors, ghost /* , passedTitleStyle, isClearType */]);

  useEffect(() => {
    if (linearGradientProps && !ViewComponent) {
      console.error(
        "You need to pass a ViewComponent to use linearGradientProps !\nExample: ViewComponent={require('react-native-linear-gradient')}",
      );
    }
  });

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
      android: linearGradientProps ? TouchableOpacity : TouchableNativeFeedback,
      default: TouchableOpacity,
    });

  const titleStyle: StyleProp<TextStyle> = useMemo(() => {
    return StyleSheet.flatten([
      { color: currentColor },
      styles.title,
      passedTitleStyle,
      disabled &&
        !ghost &&
        !isClearType && {
          color: isLight ? colors['neutral-bg1'] : colors['neutral-title2'],
        },
      disabled && disabledTitleStyle,
    ]);
  }, [
    currentColor,
    disabled,
    colors,
    disabledTitleStyle,
    passedTitleStyle,
    ghost,
    isLight,
    isClearType,
  ]);

  const innerStyle = useMemo(() => {
    const isDisabledNonClear = disabled && !isClearType;

    return StyleSheet.flatten([
      styles.button,
      styles.buttonOrientation,
      isClearType && styles.clearButtonStyle,
      {
        backgroundColor: bgColor,
        borderColor: 'transparent',
        ...(ghost && {
          borderColor: currentColor,
          backgroundColor: 'transparent',
        }),
        borderWidth: 1,
      },
      Array.isArray(buttonStyle)
        ? StyleSheet.flatten(buttonStyle)
        : buttonStyle,
      isDisabledNonClear &&
        (!ghost
          ? {
              backgroundColor:
                type === 'primary'
                  ? colors['blue-disable']
                  : colors['neutral-line'],
            }
          : {
              opacity: 0.3,
            }),
      disabled && disabledStyle,
    ]);
  }, [
    disabled,
    isClearType,
    ghost,
    bgColor,
    currentColor,
    buttonStyle,
    disabledStyle,
    type,
    colors,
  ]);

  // const background =
  //   Platform.OS === 'android' && Platform.Version >= 21
  //     ? TouchableNativeFeedback.Ripple(colord(currentColor).alpha(0.32).toRgbString(), true)
  //     : undefined;

  const loadingProps: ActivityIndicatorProps = {
    color: currentColor,
    size: 'small',
    ...passedLoadingProps,
  };

  const accessibilityState = {
    disabled: !!disabled,
    busy: !!loading,
  };

  const iconNode = useMemo(() => {
    if (typeof icon === 'function') {
      return icon({ titleStyle });
    }
    return icon;
  }, [icon, titleStyle]);

  const textNode = useMemo(() => {
    if (typeof title === 'function') {
      return title({ titleStyle });
    }
    return title;
  }, [title, titleStyle]);

  return (
    <View
      style={[styles.container, containerStyle, !height ? {} : { height }]}
      testID="RABBY_BUTTON_WRAPPER">
      <TouchableComponentInternal
        onPress={handleOnPress}
        delayPressIn={0}
        activeOpacity={0.3}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        {...rest}
        style={rest.style}>
        <ViewComponent
          {...linearGradientProps}
          style={StyleSheet.flatten([
            innerStyle,
            !height ? {} : { height: '100%' },
          ])}>
          {/* Activity Indicator on loading */}
          {loading && (
            <ActivityIndicator
              style={StyleSheet.flatten([styles.loading, loadingStyle])}
              color={loadingProps.color}
              size={loadingProps.size}
              {...loadingProps}
            />
          )}
          {(!loading || showTitleOnLoading) && (
            <>
              {iconNode && !iconRight && (
                <View
                  style={StyleSheet.flatten([
                    styles.iconContainer,
                    iconContainerStyle,
                  ])}>
                  {iconNode}
                </View>
              )}
              {/* Title for Button */}
              {!!textNode &&
                renderText(textNode, {
                  style: titleStyle,
                  ...titleProps,
                })}
              {iconNode && iconRight && (
                <View
                  style={StyleSheet.flatten([
                    styles.iconContainer,
                    iconContainerStyle,
                  ])}>
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

export const PrimaryButton = (props: ButtonProps) => {
  const { buttonStyle, containerStyle, titleStyle, ...rest } = props;
  return (
    <Button
      {...rest}
      containerStyle={[containerStyle, styles.primaryButtonContainer]}
      buttonStyle={[buttonStyle, styles.primaryButton]}
      titleStyle={[titleStyle, styles.primaryButtonTitle]}
      type={'primary'}
    />
  );
};

const styles = StyleSheet.create({
  // containerNew: { height: 52, },
  // buttonNew: { height: '100%' },
  container: {
    overflow: 'hidden',
    borderRadius: 0,
  },
  button: {
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 0,
    width: '100%',
    // height: '100%',
    height: 52,
  },
  buttonOrientation: {},
  clearButtonStyle: {
    borderRadius: 0,
  },
  title: {
    fontSize: 17,
    textAlign: 'center',
    paddingVertical: 1,
  },
  iconContainer: {
    marginHorizontal: 8,
  },
  loading: {
    marginVertical: 2,
  },
  primaryButtonContainer: {
    width: '100%',
    borderRadius: 26,
  },
  primaryButton: {
    height: 52,
  },
  primaryButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
});

Button.displayName = 'Button';

export function MiniButton({
  children,
  title = children,
  textStyle,
  ...props
}: React.ComponentProps<typeof TouchableOpacity> & {
  children?: string;
  title?: string;
  textStyle?: StyleProp<TextStyle>;
}) {
  const { styles } = useTheme2024({ getStyle: getMiniButtonStyle });

  return (
    <TouchableOpacity {...props} style={[styles.miniBtnView, props.style]}>
      {renderText(title, { style: [styles.miniBtnTextView, textStyle] })}
    </TouchableOpacity>
  );
}

const getMiniButtonStyle = createGetStyles2024(({ colors, colors2024 }) => {
  return {
    miniBtnView: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: colors2024['brand-light-2'],
      borderRadius: 4,
    },
    miniBtnTextView: {
      color: colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
