import type { AppColors2024Variants } from '@/constant/theme';

import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
  getPerpsProSolidSideTagContainerStyle,
  getPerpsProSolidSideTagTextStyle,
  getPerpsProTintedTagContainerStyle,
  getPerpsProTintedTagTextStyle,
} from './perpsProSemanticTagStyles';

const colors2024 = {
  'green-default': 'green-default',
  'green-light-1': 'green-light-1',
  'neutral-bg-5': 'neutral-bg-5',
  'neutral-foot': 'neutral-foot',
  'neutral-InvertHighlight': 'neutral-InvertHighlight',
  'red-default': 'red-default',
  'red-light-1': 'red-light-1',
} as AppColors2024Variants;

describe('perpsProSemanticTagStyles', () => {
  it('matches the metadata tag contract without a border or readability variant', () => {
    const container = getPerpsProMetadataTagContainerStyle(colors2024);
    const text = getPerpsProMetadataTagTextStyle(colors2024);

    expect(container).toEqual({
      backgroundColor: 'neutral-bg-5',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    expect(text).toEqual({
      color: 'neutral-foot',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(container).not.toHaveProperty('borderColor');
    expect(container).not.toHaveProperty('borderWidth');
    expect(text).not.toHaveProperty('fontVariant');
  });

  it.each([
    ['positive', 'green-light-1', 'green-default'],
    ['negative', 'red-light-1', 'red-default'],
  ] as const)(
    'matches the %s tinted tag contract',
    (tone, backgroundColor, color) => {
      const container = getPerpsProTintedTagContainerStyle(colors2024, tone);
      const text = getPerpsProTintedTagTextStyle(colors2024, tone);

      expect(container).toEqual({
        backgroundColor,
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
      });
      expect(text).toEqual({
        color,
        fontFamily: 'SF Pro Rounded',
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
      });
      expect(container).not.toHaveProperty('borderColor');
      expect(container).not.toHaveProperty('borderWidth');
      expect(text).not.toHaveProperty('fontVariant');
    },
  );

  it.each([
    ['positive', 'green-default'],
    ['negative', 'red-default'],
  ] as const)(
    'matches the solid %s side tag contract',
    (tone, backgroundColor) => {
      const container = getPerpsProSolidSideTagContainerStyle(colors2024, tone);
      const text = getPerpsProSolidSideTagTextStyle(colors2024);

      expect(container).toEqual({
        alignItems: 'center',
        backgroundColor,
        borderRadius: 4,
        height: 16,
        justifyContent: 'center',
        paddingHorizontal: 4,
      });
      expect(text).toEqual({
        color: 'neutral-InvertHighlight',
        fontFamily: 'SF Pro Rounded',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 16,
      });
      expect(container).not.toHaveProperty('borderColor');
      expect(container).not.toHaveProperty('borderWidth');
      expect(container).not.toHaveProperty('width');
      expect(text).not.toHaveProperty('fontVariant');
    },
  );
});
