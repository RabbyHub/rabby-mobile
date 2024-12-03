import { ColorSchemeSystem } from 'nativewind/dist/style-sheet/color-scheme';
import { themeColors, themeColorsNext2024 } from './theme-colors';

export const ThemeColors = themeColors;
export type AppColorsVariants = (typeof ThemeColors)['light'];

export const ThemeColors2024 = themeColorsNext2024;
export type AppColors2024Variants = (typeof ThemeColors2024)['light'];

export const AppColorSchemes = ['light', 'dark', 'system'] as const;
export type AppThemeScheme = ColorSchemeSystem;
