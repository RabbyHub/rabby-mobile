import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet } from 'react-native';

export const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      paddingTop: 20,
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
    },
    popupContainer: {},
    title: {
      flexDirection: 'row',
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
    },
    titleText: {
      fontSize: 16,
      lineHeight: 19,
      color: colors['neutral-title-1'],
      marginRight: 6,
    },
    valueAddress: {
      fontWeight: '500',
      marginLeft: 7,
    },
    viewMoreTable: {},
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      fontSize: 15,
    },
    firstRow: {
      maxWidth: 140,
      borderRightWidth: 0.5,
      borderRightColor: colors['neutral-line'],
      backgroundColor: colors['neutral-card-3'],
      flexShrink: 0,
    },
  });
