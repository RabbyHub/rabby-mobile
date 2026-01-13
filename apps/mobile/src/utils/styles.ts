import { AppColorsVariants, AppColors2024Variants } from '@/constant/theme';
import { IS_IOS } from '@/core/native/utils';
import {
  FontNames,
  FontWeightEnum,
  getFontWeightType,
} from '@/core/utils/fonts';
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

type CreateStylesOptions = {
  isLight: boolean;
  /**
   * @description safe area inset value
   */
  safeAreaInsets: EdgeInsets;
};
export const createGetStyles =
  <T extends NamedStyles<any>>(
    styles: (colors: AppColorsVariants, ctx?: CreateStylesOptions) => T,
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
  /**
   * @description safe area inset value
   */
  safeAreaInsets: EdgeInsets;
};
export const createGetStyles2024 =
  <T extends NamedStyles<any>>(styles: (ctx: CreateStyles2024Options) => T) =>
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

export function makeProdBorder(color = 'blue'): ViewStyle {
  return {
    borderWidth: 1,
    borderColor: color,
  };
}

export function mutateStyles<T extends NamedStyles<any>>(input: T): T {
  try {
    input = JSON.parse(JSON.stringify(input));
    // if (IS_IOS) return input;
    Object.keys(input).forEach(key => {
      const debugSymbol = input[key]?.['__DEBUG_FONT_STYLE__'];
      delete input[key]['__DEBUG_FONT_STYLE__'];

      const tInput = input[key] as TextStyle;
      if (!tInput?.fontFamily) return;

      const lcFontFamily = tInput?.fontFamily?.toLowerCase();
      const fontWeight = tInput?.fontWeight;

      let shouldDevLog = false;
      if (lcFontFamily && debugSymbol && __DEV__) {
        shouldDevLog = true;
        // console.debug('mutateStyles', input);
        console.debug(`[mutateStyles] ${key} fontFamily:`, tInput.fontFamily);
      }

      const fwTypeResult = getFontWeightType(fontWeight);

      // like sf pro rounded
      if (lcFontFamily && /^sf(.?)pro(.?)rounded$/i.test(lcFontFamily)) {
        switch (fwTypeResult.supertype) {
          case FontWeightEnum.heavy: {
            if (IS_IOS) {
              tInput.fontFamily = 'SF Pro Rounded';
            } else {
              tInput.fontFamily = FontNames.sf_pro_rounded_heavy;
              delete tInput.fontWeight;
            }
            break;
          }
          case FontWeightEnum.bold: {
            if (IS_IOS) {
              tInput.fontFamily = 'SF Pro Rounded';
            } else {
              tInput.fontFamily = FontNames.sf_pro_rounded_bold;
              delete tInput.fontWeight;
            }
            break;
          }
          case FontWeightEnum.medium: {
            if (IS_IOS) {
              tInput.fontFamily = 'SF Pro Rounded';
            } else {
              tInput.fontFamily = FontNames.sf_pro_rounded_medium;
              delete tInput.fontWeight;
            }
            break;
          }
          case FontWeightEnum.normal:
          default: {
            if (IS_IOS) {
              tInput.fontFamily = 'SF Pro Rounded';
            } else {
              tInput.fontFamily = FontNames.sf_pro_rounded_regular;
              delete tInput.fontWeight;
            }
            break;
          }
        }
      } else if (lcFontFamily && /sf(.?)pro(.?)/i.test(lcFontFamily)) {
        tInput.fontFamily = FontNames.sf_pro;
      }

      if (__DEV__ && shouldDevLog) {
        console.debug(
          `[mutateStyles] fontFamily mutated ${key}::fontFamily:`,
          tInput.fontFamily,
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
