import { ColorSchemeSystem } from 'nativewind/dist/style-sheet/color-scheme';
import { themeColors } from './theme-colors';

export const ThemeColors = themeColors;

export type AppColorsVariants = (typeof ThemeColors)['light'];

export const AppColorSchemes = ['light', 'dark', 'system'] as const;

export type AppThemeScheme = ColorSchemeSystem;
