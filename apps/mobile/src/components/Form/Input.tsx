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
} from 'react-native';

import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { BottomSheetTextInputProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetTextInput';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import TouchableView from '../Touchable/TouchableView';
import { RcIconCloseCircleCC } from '@/assets/icons/common';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';

const RcIconClose = makeThemeIconFromCC(RcIconCloseCircleCC, 'neutral-foot');

const CLOSE_ICON_WRAPPER_WIDTH = 40;
const getFormInputStyles = createGetStyles(colors => {
  return {
    inputContainer: {
      position: 'relative',
      borderRadius: 4,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['neutral-line'],
      overflow: 'hidden',
      width: '100%',
    },
    inputContainerFocusing: {
      borderColor: colors['blue-default'],
    },
    inputContainerWithIcon: {
      position: 'relative',

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingRight: 0,
    },
    errorInputContainer: {
      borderColor: colors['red-default'],
    },
    input: {
      flexShrink: 1,
      fontSize: 15,
      paddingHorizontal: 12,
      width: '100%',
      height: '100%',
      color: colors['neutral-title1'],
    },
    closeIconWrapper: {
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
    formFieldError: {
      marginTop: 12,
    },
    formFieldErrorText: {
      color: colors['red-default'],
      fontSize: 14,
      fontWeight: '400',
      textAlign: 'center',
    },
  };
});

type InputType = 'TextInput' | 'BottomSheetTextInput';
type RenderCtx = {
  clearable?: boolean;
  wrapperStyle: StyleProp<ViewStyle>;
  iconStyle: StyleProp<ViewStyle>;
  onPressClear?: React.ComponentProps<typeof TouchableView>['onPress'];
};
export const FormInput = React.forwardRef<
  TextInput,
  RNViewProps & {
    as?: InputType;
    containerStyle?: React.ComponentProps<typeof View>['style'];
    inputProps?: Omit<TextInputProps | BottomSheetTextInputProps, 'onChange'>;
    inputStyle?: React.ComponentProps<typeof TextInput>['style'];
    clearable?: boolean;
    clearIcon?: React.ReactNode | ((ctx: RenderCtx) => React.ReactNode);
    customIcon?: React.ReactNode | ((ctx: RenderCtx) => React.ReactNode);
    hasError?: boolean;
    errorText?: string;
    disableFocusingStyle?: boolean;
    fieldErrorContainerStyle?: StyleProp<ViewStyle>;
    fieldErrorTextStyle?: StyleProp<TextStyle>;
  }
>(
  (
    {
      as,
      containerStyle,
      inputProps,
      inputStyle,
      clearable,
      clearIcon,
      customIcon,
      errorText,
      disableFocusingStyle = false,
      fieldErrorContainerStyle,
      fieldErrorTextStyle,
      hasError = !!errorText,
      ...viewProps
    },
    ref,
  ) => {
    const { styles } = useThemeStyles(getFormInputStyles);

    const JSXComponent = useMemo(() => {
      switch (as) {
        default:
        case 'TextInput':
          return TextInput;
        case 'BottomSheetTextInput':
          return BottomSheetTextInput;
      }
    }, [as]);

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

    const onPressClear = useCallback<
      React.ComponentProps<typeof TouchableView>['onPress'] & object
    >(
      evt => {
        if (clearable) {
          evt?.stopPropagation?.();
          if (typeof ref !== 'function') {
            ref?.current?.clear();
          }

          inputProps?.onChangeText?.('');
        }
      },
      [ref, clearable, inputProps],
    );

    const formattedClearIcon = useMemo(() => {
      const clearWrapperStyle = StyleSheet.flatten([styles.closeIconWrapper]);
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
        <TouchableView
          disabled={!clearable}
          style={clearWrapperStyle}
          onPress={onPressClear}>
          <RcIconClose style={clearIconStyle} />
        </TouchableView>
      );
    }, [styles, clearable, clearIcon, onPressClear]);

    const formmatedCustomIcon = useMemo(() => {
      if (!customIcon) return null;

      const iconWrapperStyle = StyleSheet.flatten([styles.closeIconWrapper]);
      const iconStyle = StyleSheet.flatten([styles.closeIcon]);

      if (typeof customIcon === 'function') {
        return customIcon({
          clearable,
          iconStyle,
          wrapperStyle: iconWrapperStyle,
          onPressClear,
        });
      }
      return customIcon;
    }, [styles, customIcon, clearable, onPressClear]);

    const hasCustomIcon = !!formattedClearIcon || !!formmatedCustomIcon;

    return (
      <>
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
            viewProps?.style,
          ])}>
          <JSXComponent
            {...inputProps}
            onFocus={onFocus}
            onBlur={onBlur}
            ref={ref as any}
            style={StyleSheet.flatten([
              styles.input,
              inputStyle,
              inputProps?.style,
            ])}
          />
          {formmatedCustomIcon
            ? formmatedCustomIcon
            : clearable && inputProps?.value && (formattedClearIcon || null)}
        </View>
        {errorText && (
          <View
            style={StyleSheet.flatten([
              styles.formFieldError,
              fieldErrorContainerStyle,
            ])}>
            <Text
              style={StyleSheet.flatten([
                styles.formFieldErrorText,
                fieldErrorTextStyle,
              ])}>
              {errorText}
            </Text>
          </View>
        )}
      </>
    );
  },
);
