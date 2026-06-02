import { AppColors2024Variants } from '@/constant/theme';
import { StyleSheet } from 'react-native';

export const getStyles = (colors2024: AppColors2024Variants) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors2024['neutral-bg-4'],
      height: '100%',
      position: 'relative',
    },
    approvalTx: {
      paddingHorizontal: 15,
      flex: 1,
    },
    placeholder: {
      height: 18,
    },
  });
