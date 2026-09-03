import type { AppColors2024Variants } from '@/constant/theme';
import { BOTTOM_BUTTON_COMPACT_TITLE_STYLE } from '@/constant/layout';
import {
  FontNames,
  FontWeightEnum,
  getFontWeightType,
} from '@/core/utils/fonts';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const PERPS_PRO_FONT_FAMILY = 'SF Pro Rounded';

export const PERPS_PRO_LIGHT_FIELD_BACKGROUND = '#F4F5F5';

export const resolvePerpsProFieldBackground = ({
  darkBackground,
  isLight,
}: {
  darkBackground: string;
  isLight?: boolean;
}) => (isLight !== false ? PERPS_PRO_LIGHT_FIELD_BACKGROUND : darkBackground);

const getPerpsProAndroidFontFamily = (fontWeight?: TextStyle['fontWeight']) => {
  switch (getFontWeightType(fontWeight).supertype) {
    case FontWeightEnum.heavy:
      return 'SF-Pro-Rounded-Heavy';
    case FontWeightEnum.bold:
      return 'SF-Pro-Rounded-Bold';
    case FontWeightEnum.medium:
      return 'SF-Pro-Rounded-Medium';
    default:
      return 'SF-Pro-Rounded-Regular';
  }
};

/**
 * Use for styles that bypass createGetStyles2024/mutateStyles, such as
 * third-party TextInput and Button titleStyle props.
 */
export const getPerpsProFontStyle = (
  platform: typeof Platform.OS,
  fontWeight: TextStyle['fontWeight'] = '400',
): TextStyle =>
  platform === 'android'
    ? {
        fontFamily: getPerpsProAndroidFontFamily(fontWeight),
        fontWeight: undefined,
      }
    : {
        fontFamily: PERPS_PRO_FONT_FAMILY,
        fontWeight,
      };

export const PERPS_PRO_REGULAR_TEXT_STYLE = getPerpsProFontStyle(Platform.OS);

export const PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE: TextStyle = {
  ...BOTTOM_BUTTON_COMPACT_TITLE_STYLE,
  fontFamily: FontNames.sf_pro,
};

export const PERPS_PRO_CONFIRM_BUTTON_STYLE: ViewStyle = {
  borderRadius: 8,
};

export const getPerpsProTradeControlMediumTextStyle = (
  platform: typeof Platform.OS,
): TextStyle =>
  platform === 'android'
    ? { fontFamily: 'SF-Pro-Rounded-Medium' }
    : { fontFamily: 'SF Pro', fontWeight: '500' };

export const getPerpsProIsolatedTextStyle = (
  platform: typeof Platform.OS,
): TextStyle => ({
  ...(platform === 'android' ? { fontFamily: 'SF-Pro-Rounded-Medium' } : null),
});

export const PERPS_PRO_ISOLATED_TEXT_STYLE = getPerpsProIsolatedTextStyle(
  Platform.OS,
);

export const PERPS_PRO_ORDER_CONFIRMATION_FOOTER_TOP_OFFSET = 24;

export const getPerpsProBottomSheetChromeStyles = (
  colors2024: AppColors2024Variants,
  {
    backgroundColor = colors2024['neutral-bg-1'],
  }: {
    backgroundColor?: string;
  } = {},
): Record<'modal' | 'background' | 'handle' | 'handleIndicator', ViewStyle> => {
  return {
    modal: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overflow: 'hidden',
    },
    background: {
      backgroundColor,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    handle: {
      backgroundColor,
      height: 40,
      paddingBottom: 27,
      paddingTop: 9,
    },
    handleIndicator: {
      backgroundColor: colors2024['neutral-sheet-handle'],
      borderRadius: 2,
      height: 4,
      width: 40,
    },
  };
};
