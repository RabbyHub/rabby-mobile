import { AppColorsVariants, AppColors2024Variants } from '@/constant/theme';
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
    StyleSheet.create(styles(colors, ctx));

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
    StyleSheet.create(styles(ctx));

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
