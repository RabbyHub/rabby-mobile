import { themeColors } from './theme-colors';

export const ThemeColors = themeColors;

export type Colors = (typeof ThemeColors)['light'];
