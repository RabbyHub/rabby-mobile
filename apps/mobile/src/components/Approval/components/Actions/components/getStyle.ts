import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet } from 'react-native';

export const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      paddingTop: 20,
      backgroundColor: colors['neutral-bg2'],
      height: '100%',
    },
    handle: {
      backgroundColor: colors['neutral-bg2'],
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
      color: colors['neutral-body'],
      marginRight: 6,
    },
    valueAddress: {
      fontSize: 16,
      color: colors['neutral-title-1'],
    },
    viewMoreTable: {
      backgroundColor: colors['neutral-card1'],
      borderRadius: 8,
      paddingHorizontal: 16,
    },
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      fontSize: 15,
    },
    firstRow: {
      flexShrink: 0,
      flex: 1,
    },
  });
