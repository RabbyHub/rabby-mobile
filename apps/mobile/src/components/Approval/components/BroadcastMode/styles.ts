import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet } from 'react-native';

export const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card-1'],
      paddingHorizontal: 12,
    },
    broadcastModeBody: {},
    broadcastModeBodyUl: {
      marginTop: 16,
      marginBottom: 8,
    },
    broadcastModeBodyLi: {
      marginHorizontal: 16,
      position: 'relative',
      paddingLeft: 12,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
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
      textAlign: 'center',
    },
    optionList: {},
    modal: {
      backgroundColor: colors['neutral-bg-2'],
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    optionDesc: {
      fontSize: 13,
      color: colors['neutral-body'],
    },
    footer: {
      gap: 12,
      paddingHorizontal: 20,
      marginBottom: 40,
    },
    footerItem: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      position: 'relative',
      flexDirection: 'row',
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    footerRadio: {
      justifyContent: 'space-between',
    },
    radioIcon: {
      width: 20,
      height: 20,
    },
    footerItemText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
    },
    checked: {
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-light1'],
    },
    disabled: {
      opacity: 0.5,
    },
  });
