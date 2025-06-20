import React, { useMemo } from 'react';
import { Text as RNText, TextProps, Platform, TextStyle } from 'react-native';
import { moderateScale } from 'react-native-size-matters';

// https://github.com/react-native-elements/react-native-elements/blob/1709780f72a42b2a5d656976f2034a75a78a1796/packages/base/src/helpers/normalizeText.tsx
function normalize(number: number, factor = 0.25) {
  return moderateScale(number + 0.5, factor);
}

// Fontweight reference
// https://gist.github.com/knowbody/c5cdf26073b874eae86ba96e7cf3a540

// { fontWeight: '100' }, // Thin
// { fontWeight: '200' }, // Ultra Light
// { fontWeight: '300' }, // Light
// { fontWeight: '400' }, // Regular
// { fontWeight: '500' }, // Medium
// { fontWeight: '600' }, // Semibold
// { fontWeight: '700' }, // Bold
// { fontWeight: '800' }, // Heavy
// { fontWeight: '900' }, // Black

// android use Roboto
// use '500' in stand for semibold

//https://github.com/facebook/react-native/issues/29259#issuecomment-963763400
//https://gist.github.com/parshap/cf9cf0388d55a044004e5e78fa317b39
//   "System" Font
// A special font family, System, is available that represents the system font for the platform (San Francisco on iOS and Roboto on Android).
const defaultFontFamily = {
  ...Platform.select({
    // https://github.com/huyang2229/Blog/issues/23
    // android: { fontFamily: 'SF Pro' },
    android: { fontFamily: 'Roboto' },
    ios: { fontFamily: 'System' },
  }),
};

const RobotoLackWeights = ['200', '600', '800'];

export const Text = React.forwardRef(
  ({ style, ...rest }: TextProps, ref: React.LegacyRef<RNText>) => {
    const _fontSize = useMemo(
      () => normalize((style as TextStyle)?.fontSize || 14),
      [style],
    );
    const _fontWeight = useMemo(() => {
      const fontWeight = (style as TextStyle)?.fontWeight;

      if (
        Platform.OS === 'android' &&
        fontWeight &&
        RobotoLackWeights.includes(fontWeight as string)
      ) {
        return (Number(fontWeight) - 100).toString();
      }

      return fontWeight;
    }, [style]);

    return (
      <RNText
        style={[
          defaultFontFamily,
          style,
          {
            fontSize: _fontSize,
            fontWeight: _fontWeight as TextStyle['fontWeight'],
          },
        ]}
        {...rest}
        ref={ref}
      />
    );
  },
);
