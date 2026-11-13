import type { StyleProp, TextStyle } from 'react-native';

import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import { IS_IOS } from '../native/utils';

export const enum FontWeightEnum {
  thin = 100,
  extraLight = 200,
  ultraLight = 200,
  light = 300,
  normal = 400,
  medium = 500,
  semiBold = 600,
  bold = 700,
  extraBold = 800,
  ultraBold = 800,
  heavy = 900,
}

export const FontNames = {
  sf_pro: IS_IOS ? 'System' : 'Roboto',
};

// All nine bundled weights now resolve to their exact Android font file.
// Business 900 is Black; use RoundedFontStyles.heavy (800) when the previous
// Heavy face is intended. iOS uses Fabric's built-in ui-rounded support; this
// requires newArch.
const RoundedFonts = {
  [FontWeightEnum.thin]: { android: 'SF-Pro-Rounded-Thin', ios: '100' },
  [FontWeightEnum.ultraLight]: {
    android: 'SF-Pro-Rounded-Ultralight',
    ios: '200',
  },
  [FontWeightEnum.light]: { android: 'SF-Pro-Rounded-Light', ios: '300' },
  [FontWeightEnum.normal]: { android: 'SF-Pro-Rounded-Regular', ios: '400' },
  [FontWeightEnum.medium]: { android: 'SF-Pro-Rounded-Medium', ios: '500' },
  [FontWeightEnum.semiBold]: {
    android: 'SF-Pro-Rounded-Semibold',
    ios: '600',
  },
  [FontWeightEnum.bold]: { android: 'SF-Pro-Rounded-Bold', ios: '700' },
  [FontWeightEnum.extraBold]: { android: 'SF-Pro-Rounded-Heavy', ios: '800' },
  [FontWeightEnum.heavy]: { android: 'SF-Pro-Rounded-Black', ios: '900' },
} as const;

export function getRoundedFontStyle(
  fontWeight?: TextStyle['fontWeight'],
  platform: 'ios' | 'android' = IS_IOS ? 'ios' : 'android',
): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  const face =
    RoundedFonts[getFontWeightType(fontWeight).supertype] ||
    RoundedFonts[FontWeightEnum.normal];
  // Android: the exact file already encodes the weight, so force 'normal'.
  // `undefined` would let a preset `fontWeight` (e.g. the header preset's '500')
  // survive lodash merges and make RN synthesise a different face (QA 1388).
  return platform === 'ios'
    ? { fontFamily: 'ui-rounded', fontWeight: face.ios }
    : { fontFamily: face.android, fontWeight: 'normal' };
}

// For raw styles, pass the complete family/weight pair rather than a font name.
export const RoundedFontStyles = {
  regular: getRoundedFontStyle('400'),
  medium: getRoundedFontStyle('500'),
  bold: getRoundedFontStyle('700'),
  heavy: getRoundedFontStyle('800'),
};
/**
 * @description mutate fontFamily based on the input's fontFamily & fontWeight
 *
 * 100	Thin (Hairline)
 * 200	Extra Light (Ultra Light)
 * 300	Light
 * 400	Normal (Regular)
 * 500	Medium
 * 600	Semi Bold (Demi Bold)
 * 700	Bold
 * 800	Extra Bold (Ultra Bold)
 * 900	Black (Heavy)
 * @returns
 */
export function getFontWeightType(fontWeight?: string | number) {
  const fwStr = (fontWeight + '').toLowerCase();
  const fontWeightNumber = bizNumberUtils.coerceInteger(fontWeight, -1);

  const result = {
    supertype: FontWeightEnum.normal,
    finalFontWeight: FontWeightEnum.normal,
    inputFontWeight: fwStr,
  };

  if (!fontWeight) return result;

  if (['heavy'].includes(fwStr) || fontWeightNumber >= 900) {
    result.supertype = FontWeightEnum.heavy;
    result.finalFontWeight = FontWeightEnum.heavy;
  } else if (
    ['ultrabold', 'extrabold'].includes(fwStr) ||
    fontWeightNumber >= 800
  ) {
    result.supertype = FontWeightEnum.extraBold;
    result.finalFontWeight = FontWeightEnum.extraBold;
  } else if (['bold'].includes(fwStr) || fontWeightNumber >= 700) {
    result.supertype = FontWeightEnum.bold;
    result.finalFontWeight = FontWeightEnum.bold;
  } else if (
    ['semibold', 'demibold'].includes(fwStr) ||
    fontWeightNumber >= 600
  ) {
    result.supertype = FontWeightEnum.semiBold;
    result.finalFontWeight = FontWeightEnum.semiBold;
  } else if (['medium'].includes(fwStr) || fontWeightNumber >= 500) {
    result.supertype = FontWeightEnum.medium;
    result.finalFontWeight = FontWeightEnum.medium;
  } else if (['normal', 'regular'].includes(fwStr) || fontWeightNumber >= 400) {
    result.supertype = FontWeightEnum.normal;
    result.finalFontWeight = FontWeightEnum.normal;
  } else if (['light'].includes(fwStr) || fontWeightNumber >= 300) {
    result.supertype = FontWeightEnum.light;
    result.finalFontWeight = FontWeightEnum.light;
  } else if (
    ['extralight', 'ultralight'].includes(fwStr) ||
    fontWeightNumber >= 200
  ) {
    result.supertype = FontWeightEnum.ultraLight;
    result.finalFontWeight = FontWeightEnum.extraLight;
  } else if (['thin', 'hairline'].includes(fwStr) || fontWeightNumber >= 100) {
    result.supertype = FontWeightEnum.thin;
    result.finalFontWeight = FontWeightEnum.thin;
  }

  return result;
}

const AllSoloWeightFonts: string[] = Object.values(RoundedFonts).map(
  face => face.android,
);
type TextStyleInput = {
  fontWeight?: TextStyle['fontWeight'];
  fontFamily?: TextStyle['fontFamily'];
} & (StyleProp<
  Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight'> & {
    color?: TextStyle['color'];
  }
> &
  object);
export function cleanSpecialSoloWeightFont<T extends TextStyleInput>(
  input?: T,
) {
  if (!input) return input;

  if (input.fontFamily && AllSoloWeightFonts.includes(input.fontFamily)) {
    return {
      ...input,
      // 'normal' (not undefined): merges must be able to replace a stale preset
      // weight such as the header preset's '500' (QA 1388).
      fontWeight: 'normal',
    };
  }

  return input;
}
