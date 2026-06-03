/* eslint-disable no-restricted-imports */
import React from 'react';
import {
  Platform,
  StyleProp,
  Text as RNText,
  TextStyle,
  TextInput as RNTextInput,
} from 'react-native';
import {
  Text as RNGHTextImpl,
  TextInput as RNGHTextInputImpl,
} from 'react-native-gesture-handler';
import AnimateableTextImpl from 'react-native-animateable-text';
import { Text as RNEUITextImpl } from '@rneui/base';
import Animated from 'react-native-reanimated';
import {
  containsCJKText,
  sanitizeAndroidCJKFontStyle,
} from './textFontFallback';

// Since createAnimatedComponent return type is ComponentClass that has the props of the argument,
// but not things like NativeMethods, etc. we need to add them manually by extending the type.
interface AnimatedTextComplement extends Text {
  getNode(): Text;
}

function withDefaults<C extends React.ComponentType<any>>(
  WrappedComponent: C,
  defaultProps: Partial<React.ComponentProps<C>>,
) {
  type Props = React.ComponentProps<C>;
  type Ref = React.ComponentRef<C>;

  const Component = (props: Props) => {
    const AnyWrappedComponent = WrappedComponent as React.ComponentType<any>;
    const mergedProps = { ...defaultProps, ...props } as Props;
    const textProps = mergedProps as Props & {
      children?: React.ReactNode;
      style?: StyleProp<TextStyle>;
    };
    return (
      <AnyWrappedComponent
        {...mergedProps}
        style={sanitizeAndroidCJKFontStyle(
          textProps.style,
          containsCJKText(textProps.children),
        )}
      />
    );
  };

  Component.displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'WithDefaults';

  return Component as React.ForwardRefExoticComponent<
    React.PropsWithoutRef<Props> & React.RefAttributes<Ref>
  >;
}

const textDefaults = {
  allowFontScaling: false,
  ...Platform.select({
    android: {
      android_hyphenationFrequency: 'none' as const,
      textBreakStrategy: 'simple' as const,
    },
    default: {},
  }),
};

export const Text = withDefaults(RNText, textDefaults);
export const TextInput = withDefaults(RNTextInput, { allowFontScaling: false });
export const RNGHText = withDefaults(RNGHTextImpl, textDefaults);
export const RNGHTextInput = withDefaults(RNGHTextInputImpl, {
  allowFontScaling: false,
});
export const AnimateableText = withDefaults(AnimateableTextImpl, {
  allowFontScaling: false,
});
export const RNEUIText = withDefaults(RNEUITextImpl, {
  allowFontScaling: false,
});
export const AnimatedText = Animated.createAnimatedComponent(Text);

export type TextInput = React.ComponentRef<typeof TextInput>;
export type Text = React.ComponentRef<typeof Text>;
export type RNGHText = RNGHTextImpl;
export type RNGHTextInput = RNGHTextInputImpl;
export type AnimateableText = React.ComponentRef<typeof AnimateableText>;
export type RNEUIText = React.ComponentRef<typeof RNEUIText>;
export type AnimatedText = typeof AnimatedText & AnimatedTextComplement;
