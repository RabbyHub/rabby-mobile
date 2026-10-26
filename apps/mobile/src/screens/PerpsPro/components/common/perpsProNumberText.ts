import type { TextStyle } from 'react-native';

/**
 * Keep the existing Rounded face, size and weight; opt numeric runs into tnum.
 * Line count and available width belong to each field. Native font fitting can
 * shrink even fitting text when a fixed line height meets a rounded layout box.
 */
export const PERPS_PRO_NUMBER_STYLE: Pick<TextStyle, 'fontVariant'> = {
  fontVariant: ['tabular-nums'],
};
