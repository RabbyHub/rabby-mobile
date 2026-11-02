import { RefAttributes, useMemo } from 'react';
import { TextProps, Platform, TextStyle } from 'react-native';
import { Text as RNText } from '@/components/Typography';
import { moderateScale } from 'react-native-size-matters';

// https://github.com/react-native-elements/react-native-elements/blob/1709780f72a42b2a5d656976f2034a75a78a1796/packages/base/src/helpers/normalizeText.tsx
function normalize(number: number, factor = 0.25) {
  return moderateScale(number + 0.5, factor);
}

// Business styles use 400/500/700/900; legacy system-font semibold uses 500.
// See skills/rabby-mobile-typography/SKILL.md for family-specific rules.
// Keep the Android fallback below for legacy callers passing unsupported weights.

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

export const Text = ({
  style,
  ref,
  ...rest
}: TextProps & RefAttributes<RNText>) => {
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
};
