import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet } from 'react-native';

export const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    approvalTx: {
      paddingHorizontal: 15,
      paddingVertical: 18,
      backgroundColor: colors['neutral-bg-2'],
    },
  });
