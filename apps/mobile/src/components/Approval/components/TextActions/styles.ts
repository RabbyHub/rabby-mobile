import { StyleSheet } from 'react-native';

import { AppColorsVariants } from '@/constant/theme';

export const SIGN_MESSAGE_CARD_MARGIN = 12;

export const getMessageStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    messageContent: {
      padding: 16,
      height: 320,
      paddingTop: 0,
    },
    signMessageContent: {
      paddingHorizontal: 16,
      paddingRight: 40,
      marginRight: -24,
      paddingBottom: 16,
      maxHeight: 544,
      flexShrink: 1,
    },
    messageText: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
    messageHighlight: {
      color: colors['blue-default'],
      fontWeight: '500',
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
    messageTitleContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      zIndex: 1,
      backgroundColor: colors['neutral-card-1'],
    },
    messageTitleTextWithCopy: {
      paddingHorizontal: 0,
      backgroundColor: 'transparent',
    },
    noAction: {},
    messageCard: {
      marginTop: SIGN_MESSAGE_CARD_MARGIN,
    },
    signMessageCard: {
      marginBottom: SIGN_MESSAGE_CARD_MARGIN,
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
