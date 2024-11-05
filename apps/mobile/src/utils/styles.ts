import { AppColorsVariants } from '@/constant/theme';
import { IS_IOS } from '@/core/native/utils';
import {
  FontNames,
  FontWeightEnum,
  getFontWeightType,
} from '@/core/utils/fonts';
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

function mutateStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  input: T,
): T {
  try {
    input = JSON.parse(JSON.stringify(input));
    // if (IS_IOS) return input;
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
            input[key].fontFamily = FontNames.sf_pro_rounded_bold;
            delete input[key].fontWeight;
            break;
          }
          case FontWeightEnum.light: {
            input[key].fontFamily = FontNames.sf_pro_rounded_light;
            delete input[key].fontWeight;
            break;
          }
          default: {
            input[key].fontFamily = FontNames.sf_pro_rounded_regular;
            delete input[key].fontWeight;
            break;
          }
        }
      } else if (lcFontFamily && /sf(.?)pro(.?)/i.test(lcFontFamily)) {
        input[key].fontFamily = FontNames.sf_pro;
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
