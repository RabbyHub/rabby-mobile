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

// The business weight 900 means the bundled Heavy face, not system Black.
// iOS uses Fabric's built-in ui-rounded support; this requires newArch.
const RoundedFonts = {
  [FontWeightEnum.normal]: { android: 'SF-Pro-Rounded-Regular', ios: '400' },
  [FontWeightEnum.medium]: { android: 'SF-Pro-Rounded-Medium', ios: '500' },
  [FontWeightEnum.bold]: { android: 'SF-Pro-Rounded-Bold', ios: '700' },
  [FontWeightEnum.heavy]: { android: 'SF-Pro-Rounded-Heavy', ios: '800' },
} as const;

export function getRoundedFontStyle(
  fontWeight?: TextStyle['fontWeight'],
  platform: 'ios' | 'android' = IS_IOS ? 'ios' : 'android',
): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  const face =
    RoundedFonts[getFontWeightType(fontWeight).supertype] ||
    RoundedFonts[FontWeightEnum.normal];
  return platform === 'ios'
    ? { fontFamily: 'ui-rounded', fontWeight: face.ios }
    : { fontFamily: face.android, fontWeight: undefined };
}

// For raw styles, pass the complete family/weight pair rather than a font name.
export const RoundedFontStyles = {
  regular: getRoundedFontStyle('400'),
  medium: getRoundedFontStyle('500'),
  bold: getRoundedFontStyle('700'),
  heavy: getRoundedFontStyle('900'),
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
    fontWeightNumber > FontWeightEnum.heavy - 100
  ) {
    result.supertype = FontWeightEnum.bold;
    result.finalFontWeight = FontWeightEnum.extraBold;
  } else if (
    ['bold'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.bold - 100
  ) {
    result.supertype = FontWeightEnum.bold;
    result.finalFontWeight = FontWeightEnum.bold;
  } else if (
    ['semibold', 'demibold'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.semiBold - 100
  ) {
    result.supertype = FontWeightEnum.bold;
    result.finalFontWeight = FontWeightEnum.semiBold;
  } else if (
    ['medium'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.medium - 100
  ) {
    result.supertype = FontWeightEnum.medium;
    result.finalFontWeight = FontWeightEnum.medium;
  } else if (
    ['normal', 'regular'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.normal - 100
  ) {
    result.supertype = FontWeightEnum.normal;
    result.finalFontWeight = FontWeightEnum.normal;
  } else if (
    ['light'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.light - 100
  ) {
    result.supertype = FontWeightEnum.light;
    result.finalFontWeight = FontWeightEnum.light;
  } else if (
    ['extralight', 'ultralight'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.extraLight - 100
  ) {
    result.supertype = FontWeightEnum.light;
    result.finalFontWeight = FontWeightEnum.extraLight;
  } else if (
    ['thin', 'hairline'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.thin - 100
  ) {
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
      fontWeight: undefined,
    };
  }

  return input;
}
