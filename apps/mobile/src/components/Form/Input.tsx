import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { BottomSheetTextInputProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetTextInput';
import { useMemo } from 'react';
import { TextInputProps } from 'react-native';
import { View, TextInput } from 'react-native';

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

export function FormInput<AS extends 'TextInput' | 'BottomSheetTextInput'>({
  as,
  containerStyle,
  inputStyle,
  inputProps,
  hasError,
  ...viewProps
}: React.PropsWithoutRef<
  RNViewProps & {
    as?: AS;
    inputProps?: AS extends 'TextInput'
      ? TextInputProps
      : BottomSheetTextInputProps;
    containerStyle?: React.ComponentProps<typeof View>['style'];
    inputStyle?: React.ComponentProps<typeof TextInput>['style'];
    hasError?: boolean;
  }
>) {
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
      <JSXComponent {...inputProps} style={[styles.input, inputStyle]} />
    </View>
  );
}
