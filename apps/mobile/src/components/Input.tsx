import {
  View,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { ReactNode } from 'react';

interface InputProps extends TextInputProps {
  addonAfter?: ReactNode;
  customStyle?: ViewStyle & TextStyle;
  addonBefore?: ReactNode;
  addonWrapperStyle?: ViewStyle;
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
    inputWithAddOnWrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      height: 48,
      borderStyle: 'solid',
      backgroundColor: colors['neutral-card-2'],
      padding: 15,
      borderRadius: 6,
      width: '100%',
    },
    inputWithAddOn: {
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      padding: 0,
      paddingRight: 10,
    },
    addOnAfter: {},
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

export const BottomSheetInput = ({
  customStyle,
  addonAfter,
  addonBefore,
  addonWrapperStyle,
  ...props
}: InputProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);

  if (addonAfter || addonBefore) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.inputWithAddOnWrapper,
          addonWrapperStyle,
        ])}>
        <View style={styles.addOnAfter}>{addonBefore}</View>
        <BottomSheetTextInput
          style={{
            ...styles.inputWithAddOn,
            ...(customStyle || {}),
          }}
          {...props}
        />
        <View style={styles.addOnAfter}>{addonAfter}</View>
      </View>
    );
  }

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
