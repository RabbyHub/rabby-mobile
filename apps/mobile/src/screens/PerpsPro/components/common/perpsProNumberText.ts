import type { TextProps, TextStyle } from 'react-native';

/** Keep the existing Rounded face/weight; opt numeric runs into its tnum glyphs. */
export const PERPS_PRO_NUMBER_STYLE: Pick<TextStyle, 'fontVariant'> = {
  fontVariant: ['tabular-nums'],
};

/** Prefer native fitting in bounded numeric rows; keep the full source value. */
export const PERPS_PRO_SINGLE_LINE_NUMBER_PROPS = {
  adjustsFontSizeToFit: true,
  numberOfLines: 1,
} satisfies Pick<TextProps, 'adjustsFontSizeToFit' | 'numberOfLines'>;
