import { ThemeColors2024 } from '@/constant/theme';
import { HF_COLOR_BAD_THRESHOLD, HF_RISK_CHECKBOX_THRESHOLD } from './constant';

export const getHealthStatusColor = (
  isLight: boolean,
  healthFactor: number,
) => {
  if (!healthFactor) {
    return {
      color: 'transparent',
      backgroundColor: 'transparent',
    };
  }
  if (healthFactor < HF_COLOR_BAD_THRESHOLD) {
    return {
      color: isLight
        ? ThemeColors2024.dark['red-default']
        : ThemeColors2024.light['red-default'],
      backgroundColor: isLight
        ? ThemeColors2024.dark['red-light-4']
        : ThemeColors2024.light['red-light-4'],
    };
  }
  if (healthFactor < HF_RISK_CHECKBOX_THRESHOLD) {
    return {
      color: isLight
        ? ThemeColors2024.dark['orange-default']
        : ThemeColors2024.light['orange-default'],
      backgroundColor: isLight
        ? ThemeColors2024.dark['orange-light-4']
        : ThemeColors2024.light['orange-light-4'],
    };
  }
  return {
    color: isLight
      ? ThemeColors2024.dark['green-default']
      : ThemeColors2024.light['green-default'],
    backgroundColor: isLight
      ? ThemeColors2024.dark['green-light-4']
      : ThemeColors2024.light['green-light-4'],
  };
};
