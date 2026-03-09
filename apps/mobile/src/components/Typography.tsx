/* eslint-disable no-restricted-imports */
import React from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import {
  Text as RNGHTextImpl,
  TextInput as RNGHTextInputImpl,
} from 'react-native-gesture-handler';
import AnimateableTextImpl from 'react-native-animateable-text';
import { Text as RNEUITextImpl } from '@rneui/base';

function withDefaults<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  defaultProps: Partial<P>,
): React.ComponentType<P> {
  return (props: P) => {
    const mergedProps = { ...defaultProps, ...props } as P;
    return <WrappedComponent {...mergedProps} />;
  };
}

export const Text = withDefaults(RNText, { allowFontScaling: false });
export const TextInput = withDefaults(RNTextInput, { allowFontScaling: false });
export const RNGHText = withDefaults(RNGHTextImpl, { allowFontScaling: false });
export const RNGHTextInput = withDefaults(RNGHTextInputImpl, {
  allowFontScaling: false,
});
export const AnimateableText = withDefaults(AnimateableTextImpl, {
  allowFontScaling: false,
});
export const RNEUIText = withDefaults(RNEUITextImpl, {
  allowFontScaling: false,
});
