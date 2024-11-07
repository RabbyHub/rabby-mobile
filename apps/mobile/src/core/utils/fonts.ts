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
  sf_pro: IS_IOS ? 'SF Pro' : 'Roboto',
  sf_pro_rounded_bold: IS_IOS ? 'SFProRounded-Bold' : 'SF-Pro-Rounded-Bold',
  sf_pro_rounded_light: IS_IOS ? 'SFProRounded-Light' : 'SF-Pro-Rounded-Light',
  sf_pro_rounded_regular: IS_IOS
    ? 'SFProRounded-Regular'
    : 'SF-Pro-Rounded-Regular',
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
    type: FontWeightEnum.normal,
  };

  if (!fontWeight) return result;

  if (['heavy'].includes(fwStr) || fontWeightNumber >= 900) {
    result.supertype = FontWeightEnum.heavy;
    result.type = FontWeightEnum.heavy;
  } else if (
    ['ultrabold', 'extrabold'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.heavy - 100
  ) {
    result.supertype = FontWeightEnum.bold;
    result.type = FontWeightEnum.extraBold;
  } else if (
    ['bold'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.bold - 100
  ) {
    result.supertype = FontWeightEnum.bold;
    result.type = FontWeightEnum.bold;
  } else if (
    ['semibold', 'demibold'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.semiBold - 100
  ) {
    result.supertype = FontWeightEnum.bold;
    result.type = FontWeightEnum.semiBold;
  } else if (
    ['medium'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.medium - 100
  ) {
    result.supertype = FontWeightEnum.medium;
    result.type = FontWeightEnum.medium;
  } else if (
    ['normal', 'regular'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.normal - 100
  ) {
    result.supertype = FontWeightEnum.normal;
    result.type = FontWeightEnum.normal;
  } else if (
    ['light'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.light - 100
  ) {
    result.supertype = FontWeightEnum.light;
    result.type = FontWeightEnum.light;
  } else if (
    ['extralight', 'ultralight'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.extraLight - 100
  ) {
    result.supertype = FontWeightEnum.light;
    result.type = FontWeightEnum.extraLight;
  } else if (
    ['thin', 'hairline'].includes(fwStr) ||
    fontWeightNumber > FontWeightEnum.thin - 100
  ) {
    result.supertype = FontWeightEnum.thin;
    result.type = FontWeightEnum.thin;
  }

  return result;
}
