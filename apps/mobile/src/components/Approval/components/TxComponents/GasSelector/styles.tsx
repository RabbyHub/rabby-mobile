import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet } from 'react-native';

export const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    gasSelector: {
      marginTop: 15,
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 6,
      display: 'flex',
      padding: 16,
    },
    cardGroup: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    gasSelectorCard: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    gasSuccess: {
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    gasSuccessFalse: {
      marginBottom: 12,
    },
    gasSelectorCardMain: {
      flexDirection: 'row',
      position: 'relative',
    },
    gasSelectorCardTitle: {
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
      color: colors['neutral-title-1'],
    },
    gasSelectorCardContent: {
      marginHorizontal: 4,
    },
    gasSelectorCardContentText: {
      color: colors['neutral-title-1'],
      fontWeight: '600',
    },
    gasSelectorCardContentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    gasSelectorCardErrorText: {
      fontSize: 15,
      lineHeight: 18,
      color: colors['orange-default'],
    },
    gasSelectorCardAmount: {
      flexDirection: 'row',
    },
    gasSelectorCardAmountText: {
      fontSize: 14,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    gasSelectorCardAmountLabel: {
      color: colors['blue-default'],
      fontSize: 15,
      fontWeight: '500',
    },
    gasMore: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    gasMoreText: {
      color: colors['neutral-foot'],
      fontSize: 12,
    },
    manuallySetGasLimitAlert: {
      fontWeight: '400',
      fontSize: 13,
      lineHeight: 15,
      marginTop: 10,
      color: colors['neutral-body'],
    },
    errorWrap: {
      borderTopColor: colors['neutral-line'],
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: 14,
      paddingTop: 14,
    },
    errorWrapItem: {
      flexDirection: 'row',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 16,
      color: colors['neutral-body'],
      marginBottom: 10,
      alignItems: 'flex-start',
    },
    errorWrapIcon: {
      width: 15,
      marginRight: 8,
    },
    gasSelectorModalTop: {
      paddingTop: 12,
      paddingBottom: 24,
    },
    gasSelectorModalAmount: {
      fontWeight: '700',
      fontSize: 24,
      lineHeight: 28,
      textAlign: 'center',
      color: colors['neutral-title-1'],
      marginBottom: 8,
    },
    gasSelectorModalError: {
      fontWeight: '500',
      fontSize: 20,
      lineHeight: 23,
      textAlign: 'center',
      color: colors['orange-default'],
    },
    gasSelectorModalErrorDesc: {
      marginTop: 4,
    },
    gasSelectorModalErrorDescText: {
      fontWeight: '400',
      fontSize: 16,
      lineHeight: 19,
      textAlign: 'center',
      color: colors['neutral-body'],
    },
    gasSelectorModalUsd: {
      fontSize: 16,
      lineHeight: 19,
      textAlign: 'center',
      color: colors['neutral-body'],
    },
    cardContainer: {
      paddingHorizontal: 20,
    },
    formContainer: {
      paddingHorizontal: 20,
    },
    cardContainerTitle: {
      fontSize: 14,
      lineHeight: 16,
      color: colors['neutral-body'],
      marginBottom: 8,
    },
    cardContainerTitleDisabled: {
      opacity: 0.5,
    },
    modalWrap: {
      position: 'relative',
      flex: 1,
    },
    gasLimitLabel: {
      flexDirection: 'row',
    },
    gasLimitLabelText: {
      lineHeight: 16,
      color: colors['neutral-body'],
      marginTop: 24,
    },
    gasLimitLabelTextDisabled: {
      opacity: 0.5,
    },
    tip: {
      color: colors['neutral-foot'],
      fontSize: 12,
      marginTop: 12,
      marginBottom: 0,
    },
    tipDisabled: {
      opacity: 0.5,
      textDecorationLine: 'line-through',
    },
    recommendTimes: {
      textDecorationColor: colors['neutral-foot'],
      textDecorationLine: 'underline',
    },
    gasLimitInput: {
      width: '100%',
      padding: 15,
      borderRadius: 6,
      backgroundColor: colors['neutral-card-2'],
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      marginTop: 8,
    },
    button: {
      backgroundColor: colors['blue-default'],
    },
  });
