import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet } from 'react-native';

export const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors['neutral-bg1'],
      // backgroundColor: 'red',
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
