import { AppColorsVariants, AppColors2024Variants } from '@/constant/theme';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

type CreateStylesOptions = { isLight?: boolean };
export const createGetStyles =
  <T extends NamedStyles<T> | NamedStyles<any>>(
    styles: (
      colors: AppColorsVariants,
      ctx?: CreateStylesOptions,
    ) => T | NamedStyles<T>,
  ) =>
  (colors: AppColorsVariants, ctx?: CreateStylesOptions) =>
    StyleSheet.create(mutateStyles(styles(colors, ctx)));

type CreateStyles2024Options = {
  isLight?: boolean;
  /**
   * @description same as classicalColors
   */
  classicalColors: AppColorsVariants;
  /**
   * @description same as classicalColors
   */
  colors: AppColorsVariants;
  /**
   * @description same as colors
   */
  colors2024: AppColors2024Variants;
};
export const createGetStyles2024 =
  <T extends NamedStyles<T> | NamedStyles<any>>(
    styles: (ctx: CreateStyles2024Options) => T | NamedStyles<T>,
  ) =>
  (ctx: CreateStyles2024Options) =>
    StyleSheet.create(mutateStyles(styles(ctx)));

type TriAngleConf = {
  dir?: 'up' | 'down' | 'left' | 'right';
  size?: number;
  color?: string;
  backgroundColor?: string;
};
export function makeTriangleStyle(
  conf: TriAngleConf['dir'] | TriAngleConf = {},
): ViewStyle {
  conf = typeof conf === 'string' ? { dir: conf } : conf;

  const {
    dir = 'up',
    size = 6,
    color = 'blue',
    backgroundColor = 'transparent',
  } = conf || {};

  const retStyle: ViewStyle = {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderWidth: size,
    borderLeftColor: backgroundColor,
    borderTopColor: backgroundColor,
    borderBottomColor: backgroundColor,
    borderRightColor: backgroundColor,
  };

  switch (dir) {
    default:
    case 'up': {
      retStyle.borderBottomColor = color;
      break;
    }
    case 'down': {
      retStyle.borderTopColor = color;
      break;
    }
    case 'left': {
      retStyle.borderRightColor = color;
      break;
    }
    case 'right': {
      retStyle.borderLeftColor = color;
      break;
    }
  }

  return retStyle;
}

export function makeDevOnlyStyle<T extends any = ViewStyle>(input: T): T | {} {
  if (!__DEV__) return {};

  return input;
}

export function makeDebugBorder(color = 'blue'): ViewStyle {
  return makeDevOnlyStyle({
    borderWidth: 1,
    borderColor: color,
  });
}

const enum FontWeightEnum {
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
function getFontWeightType(fontWeight?: string | number) {
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

function mutateStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  input: T,
): T {
  try {
    input = JSON.parse(JSON.stringify(input));
    Object.keys(input).forEach(key => {
      const debugSymbol = input[key]?.['__DEBUG_FONT_STYLE__'];
      delete input[key]['__DEBUG_FONT_STYLE__'];

      if (!input[key]?.fontFamily) return;

      const lcFontFamily = input[key]?.fontFamily?.toLowerCase();
      const fontWeight = input[key]?.fontWeight;

      let shouldDevLog = false;
      if (lcFontFamily && debugSymbol && __DEV__) {
        shouldDevLog = true;
        // console.debug('mutateStyles', input);
        console.debug(
          `[mutateStyles] ${key} fontFamily:`,
          input[key].fontFamily,
        );
      }

      const fwTypeResult = getFontWeightType(fontWeight);

      // like sf pro rounded
      if (lcFontFamily && /sf(.?)pro(.?)rounded/i.test(lcFontFamily)) {
        switch (fwTypeResult.supertype) {
          case FontWeightEnum.bold: {
            input[key].fontFamily = 'SF-Pro-Rounded-Bold';
            delete input[key].fontWeight;
            break;
          }
          case FontWeightEnum.light: {
            input[key].fontFamily = 'SF-Pro-Rounded-Light';
            delete input[key].fontWeight;
            break;
          }
          default: {
            input[key].fontFamily = 'SF-Pro-Rounded-Regular';
            delete input[key].fontWeight;
            break;
          }
        }
      } else if (lcFontFamily && /sf(.?)pro(.?)/i.test(lcFontFamily)) {
        input[key].fontFamily = 'SF-Pro-Text-Regular';
      }

      if (__DEV__ && shouldDevLog) {
        console.debug(
          `[mutateStyles] fontFamily mutated ${key}::fontFamily:`,
          input[key].fontFamily,
        );
      }
    });
  } catch (error) {
    if (__DEV__) {
      console.error('[mutateStyles] error', error);
    }
  }

  return input;
}
