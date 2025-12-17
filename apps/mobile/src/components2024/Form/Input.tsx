import React, { useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  Platform,
  Keyboard,
} from 'react-native';

import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { BottomSheetTextInputProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetTextInput';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  RcIconCloseCircleCC,
  RcIconEyeCC,
  RcIconEyeCloseCC,
} from '@/assets/icons/common';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import TouchableView from '@/components/Touchable/TouchableView';
import { Pressable } from 'react-native-gesture-handler';

const RcIconClose = makeThemeIconFromCC(RcIconCloseCircleCC, 'neutral-foot');

const CLOSE_ICON_WRAPPER_WIDTH = 40;
const INPUT_SIZES = {
  PADDING_HORIZONTAL: 12,
  PADDING_TOP: 8,
  fieldNameHeight: 16,
};

const getFormInputStyles = createGetStyles2024(ctx => {
  return {
    inputContainer: {
      position: 'relative',
      height: 56,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: ctx.colors['neutral-line'],
      overflow: 'hidden',
      width: '100%',
    },
    inputContainerWithFieldName: {
      position: 'relative',
      // ...makeDebugBorder(),
    },
    fieldName: {
      fontSize: 12,
      color: ctx.colors2024['neutral-info'],
      fontFamily: 'SF Pro Rounded',
      marginBottom: 8,
      position: 'absolute',
      left: INPUT_SIZES.PADDING_HORIZONTAL,
      top: INPUT_SIZES.PADDING_TOP,
    },
    inputContainerFocusing: {
      borderColor: ctx.colors['blue-default'],
    },
    inputContainerWithIcon: {
      position: 'relative',

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingRight: 0,
    },
    errorInputContainer: {
      borderColor: ctx.colors2024['red-default'],
    },
    input: {
      flexShrink: 1,
      fontSize: 15,
      paddingHorizontal: INPUT_SIZES.PADDING_HORIZONTAL,
      width: '100%',
      height: '100%',
      color: ctx.colors['neutral-title1'],
    },
    inputWithFieldName: {
      position: 'relative',
      top: INPUT_SIZES.PADDING_TOP,
    },
    rightIconWrapper: {
      flexShrink: 0,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      width: CLOSE_ICON_WRAPPER_WIDTH,
      backgroundColor: 'transparent',
      // ...makeDebugBorder('red'),
    },
    closeIcon: {
      width: 18,
      height: 18,
    },
    formFieldTipTextContainer: {
      marginTop: 4,
      paddingLeft: 16,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    formFieldTipText: {
      fontSize: 14,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      textAlign: 'left',
      color: ctx.colors2024['neutral-info'],
    },
    formFieldErrorText: {
      color: ctx.colors2024['red-default'],
    },
  };
});

const isAndroid = Platform.OS === 'android';

type InputType = 'TextInput' | 'BottomSheetTextInput';
type RenderCtx = {
  wrapperStyle: StyleProp<ViewStyle>;
  iconStyle: StyleProp<ViewStyle>;
};
const NextInputComponent = React.forwardRef<
  TextInput,
  RNViewProps & {
    as?: InputType;
    disableNestedTouchEventOnAndroid?: boolean;
    containerStyle?: React.ComponentProps<typeof View>['style'];
    fieldName?: string;
    fieldNameStyle?: React.ComponentProps<typeof Text>['style'];
    inputProps?: Omit<TextInputProps | BottomSheetTextInputProps, 'onChange'>;
    inputStyle?: React.ComponentProps<typeof TextInput>['style'];
    clearable?: boolean;
    clearIcon?:
      | React.ReactNode
      | ((
          ctx: RenderCtx & {
            clearable?: boolean;
            onPressClear?: React.ComponentProps<
              typeof TouchableOpacity
            >['onPress'];
          },
        ) => React.ReactNode);
    customIcon?:
      | React.ReactNode
      | ((
          ctx: RenderCtx & {
            onPressCustom?: React.ComponentProps<
              typeof TouchableOpacity
            >['onPress'];
          },
        ) => React.ReactNode);
    onPressCustom?: React.ComponentProps<typeof TouchableOpacity>['onPress'];
    hasError?: boolean;
    tipText?: string;
    tipIcon?: React.ReactNode;
    disableFocusingStyle?: boolean;
    fieldErrorContainerStyle?: StyleProp<ViewStyle>;
    fieldErrorTextStyle?: StyleProp<TextStyle>;
  }
>(
  (
    {
      as: asProp,
      disableNestedTouchEventOnAndroid = false,
      fieldName,
      containerStyle,
      inputProps,
      inputStyle,
      fieldNameStyle,
      clearable,
      clearIcon,
      customIcon,
      onPressCustom,
      tipText,
      tipIcon,
      disableFocusingStyle = false,
      fieldErrorContainerStyle,
      fieldErrorTextStyle,
      hasError = false,
      ...viewProps
    },
    ref,
  ) => {
    const { styles } = useTheme2024({ getStyle: getFormInputStyles });

    const JSXComponent = useMemo(() => {
      switch (asProp) {
        default:
        case 'TextInput':
          return TextInput;
        case 'BottomSheetTextInput':
          return BottomSheetTextInput;
      }
    }, [asProp]);

    const [isFocusing, setIsFocusing] = React.useState(false);
    const onFocus = useCallback<TextInputProps['onFocus'] & object>(
      evt => {
        setIsFocusing(true);
        inputProps?.onFocus?.(evt);
      },
      [inputProps],
    );
    const onBlur = useCallback<TextInputProps['onBlur'] & object>(
      evt => {
        setIsFocusing(false);
        inputProps?.onBlur?.(evt);
      },
      [inputProps],
    );

    const innerRef = React.useRef<TextInput>(null);
    const inputRef = (ref as React.RefObject<TextInput>) || innerRef;
    const onPressClear = useCallback<
      React.ComponentProps<typeof TouchableOpacity>['onPress'] & object
    >(
      evt => {
        if (clearable) {
          evt?.stopPropagation?.();
          if (typeof inputRef !== 'function') {
            inputRef?.current?.clear();
          }

          inputProps?.onChangeText?.('');
        }
      },
      [inputRef, clearable, inputProps],
    );

    const formattedClearIcon = useMemo(() => {
      const clearWrapperStyle = StyleSheet.flatten([styles.rightIconWrapper]);
      const clearIconStyle = StyleSheet.flatten([styles.closeIcon]);

      if (typeof clearIcon === 'function') {
        return clearIcon({
          clearable,
          iconStyle: clearIconStyle,
          wrapperStyle: clearWrapperStyle,
          onPressClear,
        });
      }
      return (
        <TouchableOpacity
          disabled={!clearable}
          style={clearWrapperStyle}
          onPress={onPressClear}>
          <RcIconClose style={clearIconStyle} />
        </TouchableOpacity>
      );
    }, [styles, clearable, clearIcon, onPressClear]);

    const _onPressCustom = useCallback<
      React.ComponentProps<typeof TouchableOpacity>['onPress'] & object
    >(
      evt => {
        onPressCustom?.(evt);
      },
      [onPressCustom],
    );

    const formmatedCustomIcon = useMemo(() => {
      if (!customIcon) {
        return null;
      }

      const iconWrapperStyle = StyleSheet.flatten([styles.rightIconWrapper]);
      const iconStyle = StyleSheet.flatten([styles.closeIcon]);

      if (typeof customIcon === 'function') {
        return customIcon({
          iconStyle,
          wrapperStyle: iconWrapperStyle,
          onPressCustom: _onPressCustom,
        });
      }
      return customIcon;
    }, [styles, customIcon, _onPressCustom]);

    const hasCustomIcon = !!formattedClearIcon || !!formmatedCustomIcon;

    const needPatchTouchEvent = isAndroid && disableNestedTouchEventOnAndroid;
    const WrapperComp = needPatchTouchEvent ? Pressable : React.Fragment;

    return (
      <WrapperComp
        {...(WrapperComp !== React.Fragment && {
          onPress: () => {
            if (!Keyboard.isVisible()) {
              inputRef.current?.blur();
            }
            inputRef.current?.focus();
          },
        })}>
        <View
          {...viewProps}
          style={StyleSheet.flatten([
            styles.inputContainer,
            hasCustomIcon && styles.inputContainerWithIcon,
            hasError && styles.errorInputContainer,
            !disableFocusingStyle &&
              isFocusing &&
              !hasError &&
              styles.inputContainerFocusing,
            containerStyle,
            !!fieldName && styles.inputContainerWithFieldName,
            viewProps?.style,
          ])}>
          {fieldName && (
            <Text
              style={StyleSheet.flatten([styles.fieldName, fieldNameStyle])}>
              {fieldName}
            </Text>
          )}
          <JSXComponent
            {...inputProps}
            onFocus={onFocus}
            onBlur={onBlur}
            ref={inputRef as any}
            style={StyleSheet.flatten([
              styles.input,
              inputStyle,
              inputProps?.style,
              !!fieldName && styles.inputWithFieldName,
            ])}
          />
          {formmatedCustomIcon
            ? formmatedCustomIcon
            : clearable && inputProps?.value && (formattedClearIcon || null)}
        </View>
        {tipText && (
          <View
            style={StyleSheet.flatten([
              styles.formFieldTipTextContainer,
              fieldErrorContainerStyle,
            ])}>
            <Text
              style={StyleSheet.flatten([
                styles.formFieldTipText,
                hasError && styles.formFieldErrorText,
                fieldErrorTextStyle,
              ])}>
              {tipText}
            </Text>
            {tipIcon}
          </View>
        )}
      </WrapperComp>
    );
  },
);

export type NextInputProps = React.ComponentProps<typeof NextInputComponent>;

const PasswordInput = React.forwardRef<
  TextInput,
  NextInputProps & {
    initialPasswordVisible?: boolean;
    iconColor?: string;
  }
>(({ initialPasswordVisible = false, ...props }, ref) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getPasswordInputStyles,
  });

  const [_passwordVisible, setPasswordVisible] = React.useState(
    initialPasswordVisible,
  );

  // hide password if customIcon is provided
  const passwordVisible = !props.customIcon ? _passwordVisible : false;

  const customIconProp = useMemo(() => {
    return (
      props.customIcon ||
      ((ctx => (
        <TouchableView
          style={ctx.wrapperStyle}
          onPress={() => {
            setPasswordVisible(prev => !prev);
          }}>
          {passwordVisible ? (
            <RcIconEyeCC
              style={ctx.iconStyle}
              color={props.iconColor || colors2024['neutral-title-1']}
            />
          ) : (
            <RcIconEyeCloseCC
              style={ctx.iconStyle}
              color={props.iconColor || colors2024['neutral-title-1']}
            />
          )}
        </TouchableView>
      )) as React.FC<RenderCtx>)
    );
  }, [props.customIcon, props.iconColor, passwordVisible, colors2024]);

  return (
    <NextInput
      {...props}
      containerStyle={[styles.inputContainer, props.containerStyle]}
      inputProps={{
        placeholderTextColor: colors2024['neutral-info'],
        ...props.inputProps,
        secureTextEntry: passwordVisible ? false : true,
        // ...IS_ANDROID && {
        //   keyboardType: passwordVisible ? 'visible-password' : 'default',
        // },
      }}
      ref={ref as any}
      customIcon={customIconProp}
    />
  );
});

const getPasswordInputStyles = createGetStyles2024(ctx => {
  return {
    inputContainer: {
      height: 56,
      borderRadius: 12,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
    },
  };
});

function TextAreaInput(
  props: Omit<React.ComponentProps<typeof NextInputComponent>, 'fieldName'>,
  ref: React.ForwardedRef<TextInput>,
) {
  const { styles } = useTheme2024({ getStyle: getTextAreaInputStyles });

  const customIconProp = useMemo(() => {
    const prop_customIcon = props.customIcon;
    if (typeof prop_customIcon === 'function') {
      return (ctx => {
        ctx.wrapperStyle = StyleSheet.flatten([
          ctx.wrapperStyle,
          styles.overrideCustomIconStyle,
        ]);
        return prop_customIcon(ctx);
      }) as NextInputProps['customIcon'];
    }

    return prop_customIcon;
  }, [props.customIcon, styles.overrideCustomIconStyle]);

  return (
    <NextInput
      {...props}
      ref={ref}
      fieldName=""
      containerStyle={[styles.taContainer, props.containerStyle]}
      customIcon={customIconProp}
      inputProps={{
        placeholderTextColor: '#9B9B9B',
        ...props.inputProps,
        style: {
          backgroundColor: 'transparent',
        },
        multiline: true,
        textAlignVertical: 'top',
      }}
    />
  );
}

const ForwardedTextAreaInput = React.forwardRef(TextAreaInput);

export const NextInput = Object.assign(NextInputComponent, {
  Password: PasswordInput,
  TextArea: ForwardedTextAreaInput,
});

const getTextAreaInputStyles = createGetStyles2024(ctx => {
  return {
    taContainer: {
      height: 176,
      borderRadius: 12,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
    },
    overrideCustomIconStyle: {
      width: 'auto',
      height: 'auto',
      position: 'absolute',
      bottom: 14,
      right: 14,
    },
  };
});
