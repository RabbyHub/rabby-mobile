import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { getDimensionsSnapshot } from '@/core/dimensions';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { Button, ButtonProps } from '../Button';
import { FooterButtonGroup } from '../FooterButtonGroup';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  getViewComponentByAs,
  ReactNativeViewAs,
  ReactNativeViewAsMap,
} from '@/hooks/common/useReactNativeViews';
import AuthButton, { IAuthButtonProps } from '../AuthButton';
import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';

const getStyle = createGetStyles2024(ctx =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
      backgroundColor: 'transparent',
      // ...makeDebugBorder('green'),
    },
    main: {
      flex: 1,
      gap: 0,
      height: '100%',
      position: 'relative',
    },

    keyboardAvoidingMain: {
      height: 'auto',
      minHeight: 0,
    },
    keyboardAvoidingFooter: {
      position: 'relative',
    },

    footerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopWidth: 0,
      paddingHorizontal: 20,
      // ...makeDebugBorder('red'),
    },

    footerButtonTitle: {
      fontWeight: '500',
      fontSize: 16,
    },
    footerButtonDisabled: {
      backgroundColor: ctx.colors['blue-disable'],
    },
  }),
);

export interface FooterButtonContainer2024Props {
  noHeader?: boolean;
  children: React.ReactNode;
  buttonProps?: ButtonProps;
  authButtonProps?: IAuthButtonProps;
  buttonGroupProps?: React.ComponentProps<
    typeof import('../FooterButtonGroup').FooterButtonGroup
  >;
  style?: StyleProp<ViewStyle>;
  footerContainerHeight?: number;
  footerBottomOffset?: number;
  footerContainerStyle?: StyleProp<ViewStyle>;
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
 * |--------------|
 * | Header Area  |
 * |--------------|
 * |              |
 * |              |
 * |              |
 * |              |
 * |              |
 * |--------------|
 * |Cancel Confirm|
 * |------------- |
 */
export const FooterButtonScreenContainer = <
  T extends ReactNativeViewAs = 'View',
>({
  as: _as = 'KeyboardAvoidingView' as T,
  noHeader,
  children,
  buttonProps,
  buttonGroupProps,
  authButtonProps,
  style,
  footerContainerHeight = 56,
  footerBottomOffset = 0,
  footerContainerStyle,
}: FooterButtonContainer2024Props & { as?: T } & React.ComponentProps<
    ReactNativeViewAsMap[T]
  >) => {
  const { safeOffHeader, androidOnlyBottomOffset } = useSafeSizes();
  const columnInset = useSystemColumnInset();
  const { styles } = useTheme2024({ getStyle });
  const keyboardAvoiding = _as === 'KeyboardAvoidingView';
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!keyboardAvoiding) {
      return;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardAvoiding]);

  const { winHeight, bottomOffset, headerOffset } = useMemo(() => {
    return {
      winHeight: getDimensionsSnapshot('screen').height,
      bottomOffset: androidOnlyBottomOffset + footerBottomOffset,
      headerOffset: noHeader ? 0 : safeOffHeader,
    };
  }, [androidOnlyBottomOffset, footerBottomOffset, noHeader, safeOffHeader]);

  const ViewComp = useMemo(() => getViewComponentByAs(_as), [_as]);

  return (
    <ViewComp
      {...(_as === 'KeyboardAvoidingView' && {
        keyboardVerticalOffset: -20,
        behavior: 'padding',
      })}
      style={StyleSheet.flatten([
        styles.root,
        { height: winHeight, paddingTop: headerOffset },
        style,
      ])}>
      <View
        style={[
          styles.main,
          keyboardVisible && styles.keyboardAvoidingMain,
          columnInset.left > 0 && { paddingLeft: columnInset.left },
          columnInset.right > 0 && { paddingRight: columnInset.right },
          {
            maxHeight:
              winHeight - headerOffset - (footerContainerHeight + bottomOffset),
          },
        ]}>
        {children}
      </View>

      <View
        style={[
          styles.footerContainer,
          keyboardVisible && styles.keyboardAvoidingFooter,
          footerContainerStyle,
          {
            paddingLeft: 20 + columnInset.left,
            paddingRight: 20 + columnInset.right,
          },
          keyboardVisible
            ? { height: footerContainerHeight, marginBottom: bottomOffset }
            : { bottom: bottomOffset, height: footerContainerHeight },
        ]}>
        {buttonGroupProps && <FooterButtonGroup {...buttonGroupProps} />}
        {buttonProps && <Button type={'primary'} {...buttonProps} />}
        {authButtonProps && <AuthButton {...authButtonProps} />}
      </View>
    </ViewComp>
  );
};
