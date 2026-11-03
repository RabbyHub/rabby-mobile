import { BOTTOM_BUTTON_TITLE_STYLE } from '@/constant/layout';

/**
 * Button defaults the title lineHeight to its own height, which draws the text
 * about 2pt below center; the natural line box is centered by the button.
 */
export const MEME_BUTTON_TITLE_STYLE = {
  ...BOTTOM_BUTTON_TITLE_STYLE,
  lineHeight: undefined,
};
