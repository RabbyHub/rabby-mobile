import { AppColorsVariants } from '@/constant/theme';

export const getStyles = (colors: AppColorsVariants) => ({
  normal: {
    marginRight: 4,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['neutral-title-2'],
  },
  subtitle: {
    fontSize: 12,
    color: colors['neutral-body'],
  },
  ['import-color']: {
    marginRight: 4,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: '#000000',
  },
  numberIndex: {
    fontSize: 12,
    color: '#b4bdcc',
    marginRight: 22,
  },
});
