import {
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

interface InputProps extends TextInputProps {
  customStyle?: ViewStyle & TextStyle;
}

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    input: {
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      borderStyle: 'solid',
      backgroundColor: colors['neutral-card-2'],
      height: 48,
      width: '100%',
      fontSize: 14,
      padding: 15,
      borderRadius: 6,
    },
  });

const Input = ({ customStyle, ...props }: InputProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);
  return (
    <TextInput
      style={{
        ...styles.input,
        ...(customStyle || {}),
      }}
      {...props}
    />
  );
};

export const ButtonSheetInput = ({ customStyle, ...props }: InputProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);
  return (
    <BottomSheetTextInput
      style={{
        ...styles.input,
        ...(customStyle || {}),
      }}
      {...props}
    />
  );
};

export default Input;
