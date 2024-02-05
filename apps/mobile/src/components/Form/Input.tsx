import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
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
    },
    errorInputContainer: {
      borderColor: colors['red-default'],
    },
    input: {
      fontSize: 15,
      paddingHorizontal: 12,
    },
  };
});

export function SendInput({
  containerStyle,
  inputStyle,
  inputProps,
  hasError,
  ...viewProps
}: React.PropsWithoutRef<
  RNViewProps & {
    containerStyle?: React.ComponentProps<typeof View>['style'];
    inputStyle?: React.ComponentProps<typeof TextInput>['style'];
    inputProps?: TextInputProps;
    hasError?: boolean;
  }
>) {
  const colors = useThemeColors();
  const styles = getSendInputStyles(colors);

  return (
    <View
      {...viewProps}
      style={[
        styles.inputContainer,
        hasError && styles.errorInputContainer,
        containerStyle,
        viewProps?.style,
      ]}>
      <TextInput {...inputProps} style={[styles.input, inputStyle]} />
    </View>
  );
}
