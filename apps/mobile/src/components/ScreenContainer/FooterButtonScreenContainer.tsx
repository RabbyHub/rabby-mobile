import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {
  FootButtonProps,
  FooterButton,
} from '@/components/FooterButton/FooterButton';
import { ScreenLayouts } from '@/constant/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FooterButtonGroup } from '../FooterButton/FooterButtonGroup';

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
  btnProps?: FootButtonProps;
  style?: StyleProp<ViewStyle>;
  scrollableViewStyle?: StyleProp<ViewStyle>;
  onCancel?: () => void;
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
 *
 * or
 *
 * |-------------|
 * | Header Area |
 * |-------------|
 * |             |
 * |             |
 * |             |
 * |             |
 * |             |
 * |-------------|
 * |Cancel Confirm|
 * |-------------|
 */
export const FooterButtonScreenContainer: React.FC<Props> = ({
  buttonText,
  onPressButton,
  children,
  btnProps,
  style,
  scrollableViewStyle,
  onCancel,
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
        style,
      ])}
      behavior="padding">
      <ScrollView style={[styles.main, scrollableViewStyle]}>
        {children}
      </ScrollView>

      {onCancel ? (
        <FooterButtonGroup
          style={StyleSheet.flatten([
            { paddingBottom: 35, marginTop: 0 },
            btnProps?.footerStyle,
          ])}
          onCancel={onCancel}
          onConfirm={onPressButton}
          confirmText={buttonText}
          loading={btnProps?.loading}
          disabled={btnProps?.disabled}
        />
      ) : (
        <FooterButton
          titleStyle={styles.footerButtonTitle}
          disabledStyle={styles.footerButtonDisabled}
          title={buttonText}
          onPress={onPressButton}
          {...btnProps}
        />
      )}
    </KeyboardAvoidingView>
  );
};
