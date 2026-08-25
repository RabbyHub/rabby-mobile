import type { AppColors2024Variants } from '@/constant/theme';

import {
  getPerpsProSemanticTagContainerStyle,
  getPerpsProSemanticTagTextStyle,
  PERPS_PRO_LIGHT_NEUTRAL_TAG_BACKGROUND,
} from './perpsProSemanticTagStyles';

const colors2024 = {
  'green-default': 'green-default',
  'green-light-1': 'green-light-1',
  'green-light-2': 'green-light-2',
  'neutral-bg-5': 'neutral-bg-5',
  'neutral-body': 'neutral-body',
  'neutral-line': 'neutral-line',
  'red-default': 'red-default',
  'red-light-1': 'red-light-1',
  'red-light-2': 'red-light-2',
} as AppColors2024Variants;

describe('perpsProSemanticTagStyles', () => {
  it.each([
    [
      'positive',
      {
        backgroundColor: 'green-light-1',
        borderColor: 'green-light-2',
        textColor: 'green-default',
      },
    ],
    [
      'negative',
      {
        backgroundColor: 'red-light-1',
        borderColor: 'red-light-2',
        textColor: 'red-default',
      },
    ],
    [
      'neutral',
      {
        backgroundColor: 'neutral-bg-5',
        borderColor: 'neutral-line',
        textColor: 'neutral-body',
      },
    ],
  ] as const)(
    'maps the %s tone to the approved token family',
    (tone, expected) => {
      expect(getPerpsProSemanticTagContainerStyle(colors2024, tone)).toEqual({
        backgroundColor: expected.backgroundColor,
        borderColor: expected.borderColor,
        borderRadius: 2,
        borderWidth: 0.5,
        paddingHorizontal: 4,
        paddingVertical: 1,
      });
      expect(getPerpsProSemanticTagTextStyle(colors2024, tone)).toEqual({
        color: expected.textColor,
        fontFamily: 'SF Pro',
        fontSize: 10,
        fontWeight: '500',
        lineHeight: 12,
      });
    },
  );

  it('preserves the compact 14px variant without vertical padding', () => {
    expect(
      getPerpsProSemanticTagContainerStyle(colors2024, 'positive', {
        variant: 'compact',
      }),
    ).toEqual({
      backgroundColor: 'green-light-1',
      borderColor: 'green-light-2',
      borderRadius: 2,
      borderWidth: 0.5,
      height: 14,
      paddingHorizontal: 4,
    });
  });

  it('allows a surface-specific neutral background and text color', () => {
    expect(
      getPerpsProSemanticTagContainerStyle(colors2024, 'neutral', {
        backgroundColor: PERPS_PRO_LIGHT_NEUTRAL_TAG_BACKGROUND,
      }),
    ).toEqual(expect.objectContaining({ backgroundColor: '#F4F5F5' }));
    expect(
      getPerpsProSemanticTagTextStyle(colors2024, 'neutral', {
        color: 'neutral-secondary',
      }),
    ).toEqual(expect.objectContaining({ color: 'neutral-secondary' }));
  });
});
