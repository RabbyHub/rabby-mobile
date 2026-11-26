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
import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';
import { useSafeSizes } from '@/hooks/useAppLayout';
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
      fontWeight: '500',
      fontSize: 18,
      lineHeight: 22,
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
  /**
   * The legacy container normally applies the Duo system-column inset itself.
   * Sheets rendered inside an already-inset bottom sheet must opt out to avoid
   * applying the right inset twice.
   */
  disableColumnInset?: boolean;
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
  disableColumnInset = false,
}) => {
  const { safeOffHeader } = useSafeSizes();
  const columnInset = useSystemColumnInset();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      keyboardVerticalOffset={-20}
      style={StyleSheet.flatten([
        styles.root,
        { paddingTop: safeOffHeader },
        !disableColumnInset &&
          columnInset.left > 0 && { paddingLeft: columnInset.left },
        !disableColumnInset &&
          columnInset.right > 0 && { paddingRight: columnInset.right },
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
