import { ThemeColors2024 } from '@/constant/theme';
import { Platform } from 'react-native';

import {
  getPerpsProBottomSheetChromeStyles,
  getPerpsProFontStyle,
  getPerpsProIsolatedTextStyle,
  getPerpsProTradeControlMediumTextStyle,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
  PERPS_PRO_FONT_FAMILY,
  PERPS_PRO_ISOLATED_TEXT_STYLE,
  PERPS_PRO_LIGHT_FIELD_BACKGROUND,
  PERPS_PRO_ORDER_CONFIRMATION_FOOTER_TOP_OFFSET,
  PERPS_PRO_REGULAR_TEXT_STYLE,
  resolvePerpsProFieldBackground,
} from './perpsProVisual';

describe('Perps Pro visual contract', () => {
  it('uses the exact design background only for light field surfaces', () => {
    expect(resolvePerpsProFieldBackground({ darkBackground: '#192945' })).toBe(
      PERPS_PRO_LIGHT_FIELD_BACKGROUND,
    );
    expect(
      resolvePerpsProFieldBackground({
        darkBackground: '#192945',
        isLight: false,
      }),
    ).toBe('#192945');
  });

  it('keeps every Pro bottom sheet on the 16px and 40x4px chrome', () => {
    const lightChrome = getPerpsProBottomSheetChromeStyles(
      ThemeColors2024.light,
    );
    const darkChrome = getPerpsProBottomSheetChromeStyles(ThemeColors2024.dark);

    expect(lightChrome.modal).toMatchObject({
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    });
    expect(lightChrome.handle).toMatchObject({
      height: 40,
      paddingBottom: 27,
      paddingTop: 9,
    });
    expect(lightChrome.handleIndicator).toMatchObject({
      backgroundColor: ThemeColors2024.light['neutral-sheet-handle'],
      height: 4,
      width: 40,
    });
    expect(darkChrome.handle).toMatchObject({
      height: 40,
      paddingBottom: 27,
      paddingTop: 9,
    });
    expect(darkChrome.handleIndicator).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-sheet-handle'],
    });
  });

  it('maps raw text styles to the platform-specific rounded font face', () => {
    expect(getPerpsProFontStyle('ios', '500')).toEqual({
      fontFamily: PERPS_PRO_FONT_FAMILY,
      fontWeight: '500',
    });
    expect(getPerpsProFontStyle('android', '400')).toEqual({
      fontFamily: 'SF-Pro-Rounded-Regular',
      fontWeight: undefined,
    });
    expect(getPerpsProFontStyle('android', '500')).toEqual({
      fontFamily: 'SF-Pro-Rounded-Medium',
      fontWeight: undefined,
    });
    expect(getPerpsProFontStyle('android', '600')).toEqual({
      fontFamily: 'SF-Pro-Rounded-Bold',
      fontWeight: undefined,
    });
    expect(getPerpsProFontStyle('android', '900')).toEqual({
      fontFamily: 'SF-Pro-Rounded-Heavy',
      fontWeight: undefined,
    });
  });

  it('keeps shared button and trade-control font overrides Pro-private', () => {
    expect(PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE).toMatchObject(
      getPerpsProFontStyle(Platform.OS, '500'),
    );
    expect(PERPS_PRO_REGULAR_TEXT_STYLE).toEqual(
      getPerpsProFontStyle(Platform.OS),
    );
    expect(getPerpsProTradeControlMediumTextStyle('android')).toEqual({
      fontFamily: 'SF-Pro-Rounded-Medium',
      fontWeight: undefined,
    });
    expect(getPerpsProTradeControlMediumTextStyle('ios')).toEqual({
      fontFamily: PERPS_PRO_FONT_FAMILY,
      fontWeight: '500',
    });
    expect(
      getPerpsProTradeControlMediumTextStyle(Platform.OS).fontVariant,
    ).toBeUndefined();
    expect(PERPS_PRO_ISOLATED_TEXT_STYLE).toEqual(
      getPerpsProIsolatedTextStyle(Platform.OS),
    );
    expect(PERPS_PRO_ORDER_CONFIRMATION_FOOTER_TOP_OFFSET).toBe(24);
    expect(PERPS_PRO_CONFIRM_BUTTON_STYLE).toEqual({ borderRadius: 8 });
  });
});
