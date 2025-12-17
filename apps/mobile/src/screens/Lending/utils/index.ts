import { ThemeColors2024 } from '@/constant/theme';
import { HF_COLOR_BAD_THRESHOLD, HF_COLOR_GOOD_THRESHOLD } from './constant';

export const getHealthStatusColor = (healthFactor: number) => {
  if (healthFactor === undefined || healthFactor < 0) {
    return {
      color: 'transparent',
      backgroundColor: 'transparent',
    };
  }
  if (healthFactor < HF_COLOR_BAD_THRESHOLD) {
    return {
      color: ThemeColors2024.light['red-default'],
      backgroundColor: ThemeColors2024.light['red-light-1'],
    };
  }
  if (healthFactor < HF_COLOR_GOOD_THRESHOLD) {
    return {
      color: ThemeColors2024.light['orange-default'],
      backgroundColor: ThemeColors2024.light['orange-light-1'],
    };
  }
  return {
    color: ThemeColors2024.light['green-default'],
    backgroundColor: ThemeColors2024.light['green-light-1'],
  };
};

export const isHFEmpty = (healthFactor?: number) => {
  return !healthFactor || healthFactor <= 0;
};
