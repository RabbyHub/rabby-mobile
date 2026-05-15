import { StyleSheet } from 'react-native';

import { AppColorsVariants } from '@/constant/theme';

export const getMessageStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    messageContent: {
      padding: 16,
      height: 320,
      paddingTop: 0,
    },
    messageText: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
    messageTitle: {
      marginVertical: 12,
      position: 'relative',
      alignItems: 'center',
    },
    dashLine: {
      position: 'absolute',
      color: colors['neutral-line'],
    },
    messageTitleText: {
      fontSize: 14,
      color: colors['blue-default'],
      fontWeight: '500',
      paddingHorizontal: 10,
      textAlign: 'center',
      zIndex: 1,
      backgroundColor: colors['neutral-card-1'],
    },
    noAction: {},
    messageCard: {
      marginTop: 12,
    },
    testnetMessage: {
      padding: 15,
      fontSize: 13,
      flexWrap: 'wrap',
      lineHeight: 16,
      color: colors['neutral-body'],
      height: 260,
      fontWeight: '500',
    },
  });
