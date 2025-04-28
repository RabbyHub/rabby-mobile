import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import React, { useMemo } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
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
      fontWeight: '600',
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
  const { styles } = useTheme2024({ getStyle });

  const { winHeight, bottomOffset, headerOffset } = useMemo(() => {
    return {
      winHeight: Dimensions.get('screen').height,
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
          footerContainerStyle,
          { bottom: bottomOffset, height: footerContainerHeight },
        ]}>
        {buttonGroupProps && <FooterButtonGroup {...buttonGroupProps} />}
        {buttonProps && <Button type={'primary'} {...buttonProps} />}
        {authButtonProps && <AuthButton {...authButtonProps} />}
      </View>
    </ViewComp>
  );
};
