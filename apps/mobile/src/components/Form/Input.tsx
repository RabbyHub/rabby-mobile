import React, { useMemo } from 'react';
import { View, TextInput, TextInputProps } from 'react-native';

import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { BottomSheetTextInputProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetTextInput';

const getSendInputStyles = createGetStyles(colors => {
  return {
    inputContainer: {
      borderRadius: 4,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['neutral-line'],
      overflow: 'hidden',
      width: '100%',
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
  }
>(
  (
    { as, containerStyle, inputStyle, inputProps, hasError, ...viewProps },
    ref,
  ) => {
    const colors = useThemeColors();
    const styles = getSendInputStyles(colors);

    const JSXComponent = useMemo(() => {
      switch (as) {
        default:
        case 'TextInput':
          return TextInput;
        case 'BottomSheetTextInput':
          return BottomSheetTextInput;
      }
    }, [as]);

    return (
      <View
        {...viewProps}
        style={[
          styles.inputContainer,
          hasError && styles.errorInputContainer,
          containerStyle,
          viewProps?.style,
        ]}>
        <JSXComponent
          {...inputProps}
          ref={ref as any}
          style={[styles.input, inputStyle]}
        />
      </View>
    );
  },
);
