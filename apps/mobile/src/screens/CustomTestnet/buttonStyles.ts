import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
} from '@/constant/layout';
import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

// Keep undefined outside themed styles to clear Button's full-height lineHeight.
const getTitleStyle = (height: number): TextStyle => ({
  ...BOTTOM_BUTTON_TITLE_STYLE,
  lineHeight:
    Platform.OS === 'android' ? undefined : BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
  paddingVertical: 0,
  ...(Platform.OS === 'android' && {
    height: height - 2,
    includeFontPadding: false,
    textAlignVertical: 'center' as const,
  }),
});

export const buttonTitleStyles = {
  single: getTitleStyle(BOTTOM_BUTTON_SINGLE_HEIGHT),
  double: getTitleStyle(BOTTOM_BUTTON_DOUBLE_HEIGHT),
};
