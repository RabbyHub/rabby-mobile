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
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
  TextProps,
} from 'react-native';
import { colord } from 'colord';

import { useThemeColors, useGetAppThemeMode } from '@/hooks/theme';
import { renderText } from '@/utils/renderNode';

export type ButtonProps = TouchableOpacityProps &
  TouchableNativeFeedbackProps & {
    title?: string | React.ReactElement<{}>;
    titleStyle?: StyleProp<TextStyle>;
    titleProps?: TextProps;
    buttonStyle?: StyleProp<ViewStyle> | StyleProp<ViewStyle>[];
    type?: 'primary' | 'white' | 'clear' | 'danger';
    loading?: boolean;
    loadingStyle?: StyleProp<ViewStyle>;
    loadingProps?: ActivityIndicatorProps;
    containerStyle?: StyleProp<ViewStyle>;
    linearGradientProps?: object;
    TouchableComponent?: typeof React.Component;
    ViewComponent?: typeof React.Component;
    disabled?: boolean;
    disabledStyle?: StyleProp<ViewStyle>;
    disabledTitleStyle?: StyleProp<TextStyle>;
    ghost?: boolean;
    iconRight?: boolean;
    icon?: ReactNode;
    iconContainerStyle?: StyleProp<ViewStyle>;
  };

export const Button = ({
  title = '',
  titleStyle: passedTitleStyle,
  titleProps,
  TouchableComponent,
  containerStyle,
  onPress = () => console.log('Please attach a method to this component'),
  buttonStyle,
  type = 'primary',
  ghost,
  loading = false,
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
  const isLight = useGetAppThemeMode() === 'light';
  const colors = useThemeColors();
  const isClearType = useMemo(() => type === 'clear', [type]);

  const { currentColor, bgColor } = useMemo(() => {
    const colorMap = {
      primary: {
        bg: !ghost ? colors['blue-default'] : colors['neutral-bg1'],
        currentColor: colors['neutral-title2'],
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
    };
    return {
      currentColor: colorMap[type].currentColor || colors['neutral-title2'],
      bgColor: colorMap[type].bg || colors['blue-default'],
    };
  }, [type, colors , ghost/* , passedTitleStyle, isClearType */]);

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
          color: isLight ? '#fff' : colors['blue-light-1'],
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

  return (
    <View
      style={[styles.container, containerStyle]}
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
            styles.button,
            styles.buttonOrientation,
            isClearType && styles.clearButtonStyle,
            {
              backgroundColor: bgColor,
              borderColor: colors['blue-default'],
              borderWidth: ghost ? 1 : 0,
            },
            Array.isArray(buttonStyle)
              ? StyleSheet.flatten(buttonStyle)
              : buttonStyle,
            disabled &&
              !isClearType &&
              !ghost && {
                backgroundColor:
                  type === 'primary'
                    ? colord(colors['blue-default']).alpha(0.5).toHex()
                    : colors['neutral-line'],
              },
            disabled &&
              !isClearType &&
              ghost && {
                opacity: 0.3,
              },
            disabled && disabledStyle,
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
          {!loading && icon && !iconRight && (
            <View
              style={StyleSheet.flatten([
                styles.iconContainer,
                iconContainerStyle,
              ])}>
              {icon}
            </View>
          )}
          {/* Title for Button, hide while loading */}
          {!loading &&
            !!title &&
            renderText(title, {
              style: titleStyle,
              ...titleProps,
            })}
          {!loading && icon && iconRight && (
            <View
              style={StyleSheet.flatten([
                styles.iconContainer,
                iconContainerStyle,
              ])}>
              {icon}
            </View>
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
