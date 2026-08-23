import type { AppColors2024Variants } from '@/constant/theme';
import { FontNames } from '@/core/utils/fonts';
import { Platform } from 'react-native';

import {
  getPerpsProBottomSheetChromeStyles,
  getPerpsProIsolatedTextStyle,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
  PERPS_PRO_ISOLATED_TEXT_STYLE,
  PERPS_PRO_LIGHT_FIELD_BACKGROUND,
  PERPS_PRO_ORDER_CONFIRMATION_FOOTER_TOP_OFFSET,
  resolvePerpsProFieldBackground,
} from './perpsProVisual';

const colors2024 = {
  'neutral-bg-1': '#ffffff',
  'neutral-line': '#d9d9d9',
} as AppColors2024Variants;

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
    const contentChrome = getPerpsProBottomSheetChromeStyles(colors2024);
    const centeredChrome = getPerpsProBottomSheetChromeStyles(colors2024, {
      handlePlacement: 'centered',
    });

    expect(contentChrome.modal).toMatchObject({
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    });
    expect(contentChrome.handle).toMatchObject({
      height: 40,
      paddingBottom: 27,
      paddingTop: 9,
    });
    expect(contentChrome.handleIndicator).toMatchObject({
      height: 4,
      width: 40,
    });
    expect(centeredChrome.handle).toMatchObject({
      height: 40,
      paddingBottom: 19,
      paddingTop: 17,
    });
  });

  it('overrides the shared rounded button default with semantic SF Pro', () => {
    expect(PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE.fontFamily).toBe(
      FontNames.sf_pro,
    );
    expect(PERPS_PRO_ISOLATED_TEXT_STYLE).toEqual(
      getPerpsProIsolatedTextStyle(Platform.OS),
    );
    expect(getPerpsProIsolatedTextStyle('android')).toEqual({
      fontFamily: 'SF-Pro-Rounded-Medium',
      fontVariant: ['stylistic-six'],
    });
    expect(getPerpsProIsolatedTextStyle('ios')).toEqual({
      fontVariant: ['stylistic-six'],
    });
    expect(PERPS_PRO_ORDER_CONFIRMATION_FOOTER_TOP_OFFSET).toBe(24);
    expect(PERPS_PRO_CONFIRM_BUTTON_STYLE).toEqual({ borderRadius: 8 });
  });
});
