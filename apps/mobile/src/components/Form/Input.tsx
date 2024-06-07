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

import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { BottomSheetTextInputProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetTextInput';

const getFormInputStyles = createGetStyles(colors => {
  return {
    inputContainer: {
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
    errorInputContainer: {
      borderColor: colors['red-default'],
    },
    input: {
      fontSize: 15,
      paddingHorizontal: 12,
      width: '100%',
      height: '100%',
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
export const FormInput = React.forwardRef<
  TextInput,
  RNViewProps & {
    as?: InputType;
    inputProps?: TextInputProps | BottomSheetTextInputProps;
    containerStyle?: React.ComponentProps<typeof View>['style'];
    inputStyle?: React.ComponentProps<typeof TextInput>['style'];
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
      inputStyle,
      inputProps,
      errorText,
      disableFocusingStyle = false,
      fieldErrorContainerStyle,
      fieldErrorTextStyle,
      hasError = !!errorText,
      ...viewProps
    },
    ref,
  ) => {
    const colors = useThemeColors();
    const styles = getFormInputStyles(colors);

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

    return (
      <>
        <View
          {...viewProps}
          style={StyleSheet.flatten([
            styles.inputContainer,
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
