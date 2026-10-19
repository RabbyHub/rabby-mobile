import { HeaderTitle } from '@react-navigation/elements';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet } from 'react-native';

type DescriptorWithOptions = { options: NativeStackNavigationOptions };

/**
 * Native UINavigationBar still uses RCTFont, which cannot resolve ui-rounded.
 * Render just its title through Fabric, keeping the native bar and buttons.
 * Custom headers and large-title transitions retain their existing owners.
 */
export function createRoundedNativeStackTitleAdapter(platform: string) {
  return function adaptDescriptor<T extends DescriptorWithOptions>(
    descriptor: T,
  ): T {
    if (platform !== 'ios') {
      return descriptor;
    }

    const { options } = descriptor;
    const titleStyle = StyleSheet.flatten(options.headerTitleStyle);
    const title = options.headerTitle;

    if (
      titleStyle?.fontFamily !== 'ui-rounded' ||
      options.header != null ||
      options.headerShown === false ||
      options.headerLargeTitle
    ) {
      // A whole custom header owns these options; its native header is hidden.
      // Screens skips native font resolution while hidden, so keep its styles.
      return descriptor;
    }

    return {
      ...descriptor,
      options: {
        ...options,
        // Screens still resolves native title attributes even with a custom
        // title view. Avoid sending its legacy RCTFont an unsupported alias.
        headerTitleStyle: { ...titleStyle, fontFamily: 'System' },
        // getHeaderTitle also supplies native back-button/menu labels. Keep
        // its string result when headerTitle becomes a renderer function.
        ...(typeof title === 'string' ? { title } : {}),
        headerTitle:
          typeof title === 'function'
            ? title
            : ({ children }) => (
                <HeaderTitle
                  allowFontScaling={false}
                  tintColor={options.headerTintColor}
                  style={titleStyle}>
                  {typeof title === 'string' ? title : children}
                </HeaderTitle>
              ),
      },
    };
  };
}
