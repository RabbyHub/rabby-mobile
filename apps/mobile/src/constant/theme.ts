import { ColorSchemeSystem } from 'nativewind/dist/style-sheet/color-scheme';
export {
  ThemeColors,
  type AppColorsVariants,
  ThemeColors2024,
  type AppColors2024Variants,
} from '@rabby-wallet/base-utils';

export const AppColorSchemes = ['light', 'dark', 'system'] as const;
export type AppThemeScheme = ColorSchemeSystem;
