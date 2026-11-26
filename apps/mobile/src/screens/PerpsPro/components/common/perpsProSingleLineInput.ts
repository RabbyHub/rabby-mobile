import type { TextStyle } from 'react-native';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';

// Android clears text spans for an empty value. Use the same font metrics with
// and without text instead of switching to a LineHeightSpan after the first key.
export const PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE: TextStyle = IS_ANDROID
  ? {
      includeFontPadding: false,
      lineHeight: undefined,
      textAlignVertical: 'center',
    }
  : {};

// On iOS a lineHeight becomes a word-wrapping paragraph style. A blurred
// UITextField draws with it, so a field two lines tall shows a long value on
// two lines after Done. Keep the field one line tall; the parent centers it.
export const getPerpsProIosSingleLineInputStyle = (
  lineHeight: number,
): TextStyle => (IS_IOS ? { height: lineHeight } : {});
