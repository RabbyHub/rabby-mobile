import {
  getPerpsProDialogStyles,
  PERPS_PRO_DIALOG_TOKENS,
  resolvePerpsProDialogCardBackground,
  resolvePerpsProDialogFieldBackground,
} from '../common/perpsProDialogVisual';
import { getPerpsProListRowStyles } from '../common/perpsProListVisual';
import {
  BOTTOM_BUTTON_TOP_OFFSET,
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { createGetStyles2024 } from '@/utils/styles';
import { PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE } from '../common/perpsProSingleLineInput';

import {
  getPerpsProTintedTagContainerStyle,
  getPerpsProTintedTagTextStyle,
} from '../common/perpsProSemanticTagStyles';

// Two 30pt summary rows (Figma 86609:344969) below the order controls.
export const PERPS_PRO_CLOSE_POSITION_SHEET_HEIGHT = 584;

export const getPerpsProClosePositionSheetStyles = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    sheetView: { height: '100%' },
    scrollContent: { flexGrow: 1 },
    container: {
      ...(IS_ANDROID
        ? {
            minHeight:
              PERPS_PRO_CLOSE_POSITION_SHEET_HEIGHT -
              40 +
              getBottomButtonBottomOffset(safeAreaInsets.bottom) -
              BOTTOM_BUTTON_BOTTOM_OFFSET,
            flexGrow: 1,
          }
        : { height: '100%' }),
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    positionHeader: {
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      marginTop: 24,
      paddingBottom: 12,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    pairRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      marginBottom: 10,
    },
    pair: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    },
    longTag: getPerpsProTintedTagContainerStyle(colors2024, 'positive'),
    shortTag: getPerpsProTintedTagContainerStyle(colors2024, 'negative'),
    longTagText: getPerpsProTintedTagTextStyle(colors2024, 'positive'),
    shortTagText: getPerpsProTintedTagTextStyle(colors2024, 'negative'),
    priceSummaryRow: getPerpsProListRowStyles(colors2024).listRow,
    priceSummaryLabel: getPerpsProListRowStyles(colors2024).listLabel,
    priceSummaryValue: getPerpsProListRowStyles(colors2024).listValue,
    form: {
      gap: 0,
      marginTop: 8,
      padding: 16,
      borderRadius: 12,
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
    },
    orderRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    priceField: {
      backgroundColor: resolvePerpsProDialogFieldBackground(
        colors2024,
        isLight,
      ),
      borderRadius: 6,
      flex: 1,
      height: 40,
      justifyContent: 'center',
      minWidth: 0,
      overflow: 'hidden',
      position: 'relative',
    },
    disabledPriceField: {},
    centeredFieldText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      textAlign: 'center',
    },
    floatingLabel: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 10,
      left: 12,
      lineHeight: 12,
      position: 'absolute',
      top: 4,
      zIndex: 1,
    },
    priceInput: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      height: 40,
      lineHeight: 18,
      paddingBottom: 0,
      paddingLeft: 12,
      paddingRight: 56,
      paddingTop: 12,
      ...PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE,
    },
    priceUnit: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      position: 'absolute',
      right: 12,
    },
    orderTypeField: {
      alignItems: 'center',
      backgroundColor: resolvePerpsProDialogFieldBackground(
        colors2024,
        isLight,
      ),
      borderRadius: 6,
      flexDirection: 'row',
      height: 40,
      justifyContent: 'center',
      width: 100,
    },
    // Figma 86609:344546: the order-type toggle uses the Pro action color.
    orderTypeText: {
      color: PERPS_PRO_DIALOG_TOKENS.actionBackground,
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    },
    orderTypeSwitch: { marginLeft: 4 },
    amountGroup: { gap: 10 },
    amountField: {
      backgroundColor: resolvePerpsProDialogFieldBackground(
        colors2024,
        isLight,
      ),
      borderRadius: 6,
      height: 40,
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    amountInput: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      height: 40,
      includeFontPadding: false,
      lineHeight: 18,
      paddingBottom: 0,
      paddingLeft: 12,
      paddingRight: 72,
      paddingTop: 12,
      textAlignVertical: 'center',
      ...PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE,
    },
    amountUnit: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      position: 'absolute',
      right: 12,
    },
    summary: {
      marginTop: 8,
    },
    summaryRow: getPerpsProListRowStyles(colors2024).listRow,
    summaryLabel: getPerpsProListRowStyles(colors2024).listLabel,
    summaryValue: getPerpsProListRowStyles(colors2024).listValue,
    positiveValue: {
      ...getPerpsProListRowStyles(colors2024).listValue,
      color: colors2024['green-default'],
    },
    negativeValue: {
      ...getPerpsProListRowStyles(colors2024).listValue,
      color: colors2024['red-default'],
    },
    footer: {
      paddingHorizontal: 4,
      marginTop: 'auto',
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET * 2,
    },
  }),
);
