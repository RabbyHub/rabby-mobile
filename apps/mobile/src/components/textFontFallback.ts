import { Children, isValidElement, type ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, TextStyle } from 'react-native';

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

export function shouldUseAndroidSystemFontForCJK(
  hasCJK: boolean,
  platformOS = Platform.OS,
) {
  return platformOS === 'android' && hasCJK;
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
