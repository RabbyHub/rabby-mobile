import { AppColorsVariants } from '@/constant/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StyleSheet } from 'react-native';

export const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    height: 24,
  },

  gasView: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },

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
    marginBottom: 12,
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
    alignItems: 'center',
  },
  gasSelectorCardTitle: {
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 19,
    color: colors['neutral-title-1'],
  },
  gasSelectorCardContent: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gasSelectorCardAmountText: {
    fontSize: 14,
    lineHeight: 16,
    color: colors['neutral-foot'],
  },
  gasSelectorCardAmountLabel: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  gasSelectorCardAmountLabelUsd: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  gasSelectorCardAmountLabelAmount: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  gasCostAmount: {
    color: colors['neutral-body'],
    marginTop: 2,
    flexShrink: 0,
    fontSize: 14,
  },
  gasAccountTip: {
    fontSize: 13,
    fontWeight: '400',
    color: colors['neutral-title-2'],
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
  sheetTitle: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '900',
    lineHeight: 24,
  },
  gasSelectorModalTop: {
    paddingBottom: 24,
  },
  gasSelectorModalAmount: {
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    lineHeight: 42,
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
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
  gasSelectorModalUsdWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gasSelectorModalUsd: {
    fontSize: 15,
    lineHeight: 18,
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
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    color: colors['neutral-title-1'],
    marginBottom: 8,
  },
  cardContainerTitleDisabled: {
    opacity: 0.5,
  },
  modalWrap: {
    position: 'relative',
    flex: 1,
    backgroundColor: colors['neutral-bg1'],
  },
  gasLimitLabel: {
    paddingHorizontal: 20,
  },
  gasLimitLabelText: {
    lineHeight: 16,
    color: colors['neutral-title1'],
    fontSize: 13,
  },
  gasLimitLabelTextDisabled: {
    opacity: 0.5,
  },
  nonceTitle: {
    lineHeight: 16,
    color: colors['neutral-title1'],
    marginTop: 20,
    fontSize: 13,
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
    padding: 15,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
    borderColor: colors['neutral-line'],
    borderWidth: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    marginTop: 8,
  },
  button: {
    backgroundColor: colors['blue-default'],
  },
  gasPriceDesc: {
    marginTop: 20,
    gap: 12,
  },
  gasPriceDescDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors2024['neutral-secondary'],
    marginHorizontal: 8,
  },
  gasPriceDescText: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  gasPriceDescBoldText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  gasPriceDescItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeDivider: {
    backgroundColor: 'transparent',
    marginVertical: 15,
  },
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeHeaderText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginRight: 2,
  },
  feeTipText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 12,
  },
  feeTip: {
    padding: 10,
    gap: 10,
  },
  feeInput: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 8,
    backgroundColor: colors2024['neutral-bg-2'],
    fontSize: 17,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
  },
  fixedModeContainer: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fixedModeText: {
    marginLeft: 4,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 16,
  },
  feeContainer: {
    marginHorizontal: 20,
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  cardBody: {
    padding: 12,
  },
  cardBodyText: {
    fontSize: 13,
    lineHeight: 15,
    color: colors['neutral-body'],
  },
  cardModal: {
    backgroundColor: colors['neutral-bg2'],
  },
  cardMain: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  cardItem: {},
  fixedContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
}));
/**
 * @deprecated
 */
export const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      height: 24,
    },

    gasView: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      position: 'relative',
    },

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
      marginBottom: 12,
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
      alignItems: 'center',
    },
    gasSelectorCardTitle: {
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
      color: colors['neutral-title-1'],
    },
    gasSelectorCardContent: {
      flex: 1,
      marginHorizontal: 4,
      alignItems: 'center',
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
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    gasSelectorCardAmountText: {
      fontSize: 14,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    gasSelectorCardAmountLabel: {
      color: colors['blue-default'],
      fontSize: 16,
      fontWeight: '500',
    },
    gasCostAmount: {
      color: colors['neutral-body'],
      marginTop: 2,
      flexShrink: 0,
      fontSize: 14,
    },
    gasAccountTip: {
      fontSize: 13,
      fontWeight: '400',
      color: colors['neutral-title-2'],
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
    gasSelectorModalUsdWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    gasSelectorModalUsd: {
      fontSize: 15,
      lineHeight: 18,
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
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-title-1'],
      marginBottom: 8,
    },
    cardContainerTitleDisabled: {
      opacity: 0.5,
    },
    modalWrap: {
      position: 'relative',
      flex: 1,
      backgroundColor: colors['neutral-bg2'],
    },
    gasLimitLabel: {
      paddingHorizontal: 20,
    },
    gasLimitLabelText: {
      lineHeight: 16,
      color: colors['neutral-title1'],
      fontSize: 13,
    },
    gasLimitLabelTextDisabled: {
      opacity: 0.5,
    },
    nonceTitle: {
      lineHeight: 16,
      color: colors['neutral-title1'],
      marginTop: 20,
      fontSize: 13,
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
      padding: 15,
      borderRadius: 8,
      backgroundColor: colors['neutral-card-1'],
      borderColor: colors['neutral-line'],
      borderWidth: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      marginTop: 8,
    },
    button: {
      backgroundColor: colors['blue-default'],
    },
    gasPriceDesc: {
      marginTop: 20,
      gap: 12,
    },
    gasPriceDescText: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
    gasPriceDescBoldText: {
      color: colors['neutral-title1'],
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '500',
    },
    gasPriceDescItem: {
      flexDirection: 'row',
    },
    feeDivider: {
      backgroundColor: colors['neutral-line'],
      marginVertical: 20,
    },
    feeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    feeHeaderText: {
      color: colors['neutral-title1'],
      fontSize: 13,
      lineHeight: 16,
      marginRight: 2,
    },
    feeTipText: {
      color: colors['neutral-title2'],
      fontSize: 12,
    },
    feeTip: {
      padding: 10,
      gap: 10,
    },
    feeInput: {
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors['neutral-card-1'],
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      borderWidth: 1,
      borderColor: colors['neutral-line'],
    },
    feeContainer: {
      marginHorizontal: 20,
      marginBottom: 32,
    },
    footer: {
      backgroundColor: colors['neutral-bg2'],
    },
    cardBody: {
      padding: 12,
    },
    cardBodyText: {
      fontSize: 13,
      lineHeight: 15,
      color: colors['neutral-body'],
    },
    cardModal: {
      backgroundColor: colors['neutral-bg2'],
    },
    cardMain: {
      paddingHorizontal: 20,
      marginBottom: 32,
    },
    cardItem: {},
  });
