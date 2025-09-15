import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import {
  Text as RNGHText,
  TextInput as RNGHTextInput,
} from 'react-native-gesture-handler';

import type { StyleProp, TextStyle } from 'react-native';
import AnimateableText from 'react-native-animateable-text';

import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import { IS_ANDROID, IS_IOS } from '../native/utils';
import { Text as RNEUIText } from '@rneui/base';

if (IS_ANDROID || IS_IOS) {
  // @ts-expect-error
  RNText.defaultProps = Object.assign({}, RNText.defaultProps, {
    allowFontScaling: false,
  });
  // @ts-expect-error
  RNTextInput.defaultProps = Object.assign({}, RNTextInput.defaultProps, {
    allowFontScaling: false,
  });
  RNGHText.defaultProps = Object.assign({}, RNGHText.defaultProps, {
    allowFontScaling: false,
  });
  RNGHTextInput.defaultProps = Object.assign({}, RNGHTextInput.defaultProps, {
    allowFontScaling: false,
  });
  AnimateableText.defaultProps = Object.assign(
    {},
    AnimateableText.defaultProps,
    {
      allowFontScaling: false,
    },
  );
  RNEUIText.defaultProps = Object.assign({}, RNEUIText.defaultProps, {
    allowFontScaling: false,
  });
}

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
  sf_pro: IS_IOS ? 'SF Pro' : 'Roboto',
  sf_pro_rounded_bold: IS_IOS ? 'SFProRounded-Bold' : 'SF-Pro-Rounded-Bold',
  sf_pro_rounded_regular: IS_IOS
    ? 'SFProRounded-Regular'
    : 'SF-Pro-Rounded-Regular',
  sf_pro_rounded_medium: IS_IOS
    ? 'SFProRounded-Medium'
    : 'SF-Pro-Rounded-Medium',
  sf_pro_rounded_heavy: IS_IOS ? 'SFProRounded-Heavy' : 'SF-Pro-Rounded-Heavy',
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

const AllSoloWeightFonts = [
  FontNames.sf_pro_rounded_bold,
  FontNames.sf_pro_rounded_regular,
  FontNames.sf_pro_rounded_medium,
  FontNames.sf_pro_rounded_heavy,
];
type TextStyleInput = {
  fontWeight?: TextStyle['fontWeight'];
  fontFamily?: TextStyle['fontFamily'];
} & (StyleProp<
  Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight'> & {
    color?: string;
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
