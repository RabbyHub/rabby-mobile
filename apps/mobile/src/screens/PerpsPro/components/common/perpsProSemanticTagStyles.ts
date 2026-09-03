import type { AppColors2024Variants } from '@/constant/theme';
import type { TextStyle, ViewStyle } from 'react-native';

import { PERPS_PRO_FONT_FAMILY } from './perpsProVisual';

export const PERPS_PRO_LIGHT_NEUTRAL_TAG_BACKGROUND = '#F4F5F5';

export type PerpsProSemanticTagTone = 'negative' | 'neutral' | 'positive';
export type PerpsProSemanticTagVariant = 'compact' | 'regular';

type PerpsProSemanticTagContainerOptions = Readonly<{
  backgroundColor?: ViewStyle['backgroundColor'];
  variant?: PerpsProSemanticTagVariant;
}>;

type PerpsProSemanticTagTextOptions = Readonly<{
  color?: TextStyle['color'];
}>;

const resolveToneColors = (
  colors2024: AppColors2024Variants,
  tone: PerpsProSemanticTagTone,
) => {
  switch (tone) {
    case 'positive':
      return {
        backgroundColor: colors2024['green-light-1'],
        borderColor: colors2024['green-light-2'],
        textColor: colors2024['green-default'],
      };
    case 'negative':
      return {
        backgroundColor: colors2024['red-light-1'],
        borderColor: colors2024['red-light-2'],
        textColor: colors2024['red-default'],
      };
    case 'neutral':
      return {
        backgroundColor: colors2024['neutral-bg-5'],
        borderColor: colors2024['neutral-line'],
        textColor: colors2024['neutral-body'],
      };
  }
};

export const getPerpsProSemanticTagContainerStyle = (
  colors2024: AppColors2024Variants,
  tone: PerpsProSemanticTagTone,
  {
    backgroundColor,
    variant = 'regular',
  }: PerpsProSemanticTagContainerOptions = {},
): ViewStyle => {
  const toneColors = resolveToneColors(colors2024, tone);
  return {
    backgroundColor: backgroundColor ?? toneColors.backgroundColor,
    borderColor: toneColors.borderColor,
    borderRadius: 2,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    ...(variant === 'compact' ? { height: 14 } : { paddingVertical: 1 }),
  };
};

export const getPerpsProSemanticTagTextStyle = (
  colors2024: AppColors2024Variants,
  tone: PerpsProSemanticTagTone,
  { color }: PerpsProSemanticTagTextOptions = {},
): TextStyle => ({
  color: color ?? resolveToneColors(colors2024, tone).textColor,
  fontFamily: 'SF Pro',
  fontSize: 10,
  fontWeight: '500',
  lineHeight: 12,
});

export type PerpsProTintedTagTone = 'negative' | 'positive';

export const getPerpsProMetadataTagContainerStyle = (
  colors2024: AppColors2024Variants,
): ViewStyle => ({
  backgroundColor: colors2024['neutral-bg-5'],
  borderRadius: 4,
  paddingHorizontal: 4,
  paddingVertical: 1,
});

export const getPerpsProMetadataTagTextStyle = (
  colors2024: AppColors2024Variants,
): TextStyle => ({
  color: colors2024['neutral-foot'],
  fontFamily: PERPS_PRO_FONT_FAMILY,
  fontSize: 12,
  fontWeight: '500',
  lineHeight: 16,
});

export const getPerpsProTintedTagContainerStyle = (
  colors2024: AppColors2024Variants,
  tone: PerpsProTintedTagTone,
): ViewStyle => ({
  backgroundColor: resolveToneColors(colors2024, tone).backgroundColor,
  borderRadius: 4,
  paddingHorizontal: 4,
  paddingVertical: 1,
});

export const getPerpsProTintedTagTextStyle = (
  colors2024: AppColors2024Variants,
  tone: PerpsProTintedTagTone,
): TextStyle => ({
  color: resolveToneColors(colors2024, tone).textColor,
  fontFamily: PERPS_PRO_FONT_FAMILY,
  fontSize: 12,
  fontWeight: '500',
  lineHeight: 16,
});

export const getPerpsProSolidSideTagContainerStyle = (
  colors2024: AppColors2024Variants,
  tone: PerpsProTintedTagTone,
): ViewStyle => ({
  alignItems: 'center',
  backgroundColor: resolveToneColors(colors2024, tone).textColor,
  borderRadius: 4,
  height: 16,
  justifyContent: 'center',
  paddingHorizontal: 4,
});

export const getPerpsProSolidSideTagTextStyle = (
  colors2024: AppColors2024Variants,
): TextStyle => ({
  color: colors2024['neutral-InvertHighlight'],
  fontFamily: PERPS_PRO_FONT_FAMILY,
  fontSize: 12,
  fontWeight: '700',
  lineHeight: 16,
});
