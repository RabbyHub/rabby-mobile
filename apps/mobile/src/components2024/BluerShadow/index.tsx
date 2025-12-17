import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from '@react-native-community/blur';

const isAndroid = Platform.OS === 'android';

interface Props {
  children: React.ReactNode;
  blurAmount?: number;
  isLight?: boolean;
  borderRadius?: number;
  viewTypeOnNoShadow?: 'fragment' | 'view';
  viewProps?: ViewProps;
}

export const BlurShadowView = React.forwardRef<View, Props>(
  (
    {
      children,
      isLight,
      blurAmount = 29,
      borderRadius = 20,
      viewProps,
      viewTypeOnNoShadow = viewProps ? 'view' : 'fragment',
    },
    ref,
  ) => {
    if (!isLight || isAndroid) {
      if (viewTypeOnNoShadow === 'fragment') {
        if (ref && __DEV__) {
          console.warn(
            '[BlurShadowView] ref is ignored when viewTypeOnNoShadow is "fragment"',
          );
        }
        return children;
      }

      return (
        <View ref={ref} {...viewProps}>
          {children}
        </View>
      );
    }

    return (
      <View
        ref={ref}
        {...viewProps}
        style={[
          isLight ? styles.lightContainer : styles.container,
          viewProps?.style,
        ]}>
        <BlurView
          style={StyleSheet.flatten([styles.blur, { borderRadius }])}
          blurAmount={blurAmount}
          blurType="light"
          reducedTransparencyFallbackColor="white">
          {children}
        </BlurView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 0, 0, 0.12)',
        shadowOffset: {
          width: 0,
          height: 15,
        },
        shadowOpacity: 1,
        shadowRadius: 27.5,
      },
    }),
  },
  lightContainer: {
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(55, 56, 63)',
        shadowOffset: {
          width: 0,
          height: 18,
        },
        shadowOpacity: 0.04,
        shadowRadius: 29,
      },
    }),
  },
  blur: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
});
