import { ThemeColors2024 } from '@/constant/theme';
// Figma 84558:89226 (candles), 84558:88337 (interval sheet).
export const SIMPLE_CHART_COLORS = {
  accent: '#23C0B0',
  areaFill: '#50D2C1',
  up: '#36B16D',
  down: '#E85046',
  selected: 'rgba(80,210,193,0.1)',
  selectedBorder: 'rgba(35,192,176,0.4)',
  buttonText: '#040601',
  buttonShadow: ThemeColors2024.dark['brand-default'],
} as const;
