import {
  Children,
  RefAttributes,
  isValidElement,
  type ReactNode,
  useMemo,
} from 'react';
import {
  TextProps,
  Platform,
  TextStyle,
  StyleProp,
  StyleSheet,
} from 'react-native';
import { Text as RNText } from '@/components/Typography';
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

const CJK_RE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const SF_PRO_RE =
  /^SF(?:[-\s]?Pro|Pro)(?:[-\s]?Rounded)?(?:[-\s]?(Regular|Medium|Bold|Heavy))?$/i;

function collectText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string') {
    return node;
  }

  if (typeof node === 'number' || typeof node === 'bigint') {
    return String(node);
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return collectText(node.props.children);
  }

  let text = '';
  Children.forEach(node, child => {
    text += collectText(child);
  });
  return text;
}

export function containsCJKText(node: ReactNode) {
  return CJK_RE.test(collectText(node));
}

function inferFontWeightFromFamily(fontFamily?: TextStyle['fontFamily']) {
  if (!fontFamily) {
    return undefined;
  }

  if (/Heavy$/i.test(fontFamily)) {
    return '900';
  }

  if (/Bold$/i.test(fontFamily)) {
    return '700';
  }

  if (/Medium$/i.test(fontFamily)) {
    return '500';
  }

  if (/Regular$/i.test(fontFamily)) {
    return '400';
  }

  return undefined;
}

export function sanitizeAndroidCJKFontStyle(
  style: StyleProp<TextStyle>,
  hasCJK: boolean,
  platformOS = Platform.OS,
) {
  const flattenedStyle = StyleSheet.flatten(style) || {};

  if (
    platformOS !== 'android' ||
    !hasCJK ||
    !flattenedStyle.fontFamily ||
    !SF_PRO_RE.test(flattenedStyle.fontFamily)
  ) {
    return flattenedStyle;
  }

  const inferredFontWeight = inferFontWeightFromFamily(
    flattenedStyle.fontFamily,
  );
  const nextStyle = { ...flattenedStyle };
  delete nextStyle.fontFamily;

  return {
    ...nextStyle,
    fontWeight: nextStyle.fontWeight || inferredFontWeight,
  };
}

export const Text = ({
  style,
  children,
  ref,
  ...rest
}: TextProps & RefAttributes<RNText>) => {
  const hasCJK = useMemo(() => containsCJKText(children), [children]);
  const sanitizedStyle = useMemo(
    () => sanitizeAndroidCJKFontStyle(style, hasCJK),
    [hasCJK, style],
  );
  const _fontSize = useMemo(
    () => normalize((sanitizedStyle as TextStyle)?.fontSize || 14),
    [sanitizedStyle],
  );
  const _fontWeight = useMemo(() => {
    const fontWeight = (sanitizedStyle as TextStyle)?.fontWeight;

    if (
      Platform.OS === 'android' &&
      fontWeight &&
      RobotoLackWeights.includes(fontWeight as string)
    ) {
      return (Number(fontWeight) - 100).toString();
    }

    return fontWeight;
  }, [sanitizedStyle]);

  return (
    <RNText
      style={[
        defaultFontFamily,
        sanitizedStyle,
        {
          fontSize: _fontSize,
          fontWeight: _fontWeight as TextStyle['fontWeight'],
        },
      ]}
      {...rest}
      ref={ref}>
      {children}
    </RNText>
  );
};
