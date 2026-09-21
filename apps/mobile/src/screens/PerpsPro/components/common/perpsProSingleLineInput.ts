import type { TextStyle } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';

// Android clears text spans for an empty value. Use the same font metrics with
// and without text instead of switching to a LineHeightSpan after the first key.
export const PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE: TextStyle = IS_ANDROID
  ? {
      includeFontPadding: false,
      lineHeight: undefined,
      textAlignVertical: 'center',
    }
  : {};
