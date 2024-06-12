import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { ScreenLayouts } from '@/constant/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
      backgroundColor: colors['neutral-bg-2'],
    },
    main: {
      flex: 1,
      paddingHorizontal: 20,
    },

    footerButtonTitle: {
      fontWeight: '600',
      fontSize: 16,
    },
    footerButtonDisabled: {
      backgroundColor: colors['blue-disable'],
    },
  });

interface Props {
  children: React.ReactNode;
  onPressButton: () => void;
  buttonText: string;
  buttonDisabled?: boolean;
}

/**
 * |-------------|
 * | Header Area |
 * |-------------|
 * |             |
 * |             |
 * |             |
 * |             |
 * |-------------|
 * |Footer Button|
 * |-------------|
 */
export const FooterButtonScreenContainer: React.FC<Props> = ({
  buttonText,
  buttonDisabled,
  onPressButton,
  children,
}) => {
  const { top } = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      keyboardVerticalOffset={-20}
      style={StyleSheet.flatten([
        styles.root,
        { paddingTop: top + ScreenLayouts.headerAreaHeight },
      ])}
      behavior="padding">
      <ScrollView style={styles.main}>{children}</ScrollView>
      <FooterButton
        titleStyle={styles.footerButtonTitle}
        disabledStyle={styles.footerButtonDisabled}
        title={buttonText}
        onPress={onPressButton}
        disabled={buttonDisabled}
      />
    </KeyboardAvoidingView>
  );
};
