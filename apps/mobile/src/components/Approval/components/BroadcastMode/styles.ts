import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet } from 'react-native';

export const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card-1'],
      paddingHorizontal: 12,
    },
    broadcastMode: {},
    broadcastModeHeader: {
      display: 'flex',
      padding: 16,
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors['neutral-line'],
      flexDirection: 'row',
    },
    broadcastModeTitle: {
      color: colors['neutral-title-1'],
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 18,
    },
    broadcastModeExtra: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginLeft: 'auto',
      flexDirection: 'row',
    },
    broadcastModeExtraText: {
      color: colors['neutral-title-1'],
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 18,
    },
    broadcastModeBody: {
      paddingVertical: 12,
    },
    broadcastModeBodyUl: {
      marginTop: 0,
      marginBottom: 0,
    },
    broadcastModeBodyLi: {
      position: 'relative',
      marginTop: 8,
      paddingLeft: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    broadcastModeBodyLiBefore: {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: 100,
      backgroundColor: colors['neutral-body'],
      left: 0,
      top: 8,
    },
    broadcastModeBodyLiText: {
      fontSize: 13,
      color: colors['neutral-body'],
    },
    broadcastModeBodyLiFirst: {
      marginTop: 0,
    },
    deadlineOptions: {
      gap: 6,
      alignItems: 'center',
      flexDirection: 'row',
    },
    deadlineOption: {
      paddingVertical: 2,
      paddingHorizontal: 4,
      borderRadius: 2,
      backgroundColor: colors['neutral-card-2'],
      minWidth: 40,
      color: colors['neutral-title-1'],
      textAlign: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    deadlineOptionSelected: {
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-light-1'],
    },
    deadlineOptionText: {
      color: colors['neutral-title-1'],
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 16,
    },
  });
