import {
  getPerpsProDialogStyles,
  resolvePerpsProDialogCardBackground,
  resolvePerpsProDialogFieldBackground,
} from '../common/perpsProDialogVisual';
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

export const getPerpsProClosePositionSheetStyles = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    sheetView: { height: '100%' },
    scrollContent: { flexGrow: 1 },
    container: {
      ...(IS_ANDROID
        ? {
            minHeight:
              550 -
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
      gap: 10,
      marginTop: 24,
      padding: 16,
    },
    pairRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
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
    priceSummaryRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    priceSummaryLabel: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
    },
    priceSummaryValue: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
    },
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
    orderTypeText: {
      color: colors2024['neutral-title-1'],
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
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      position: 'absolute',
      right: 12,
    },
    summary: {
      gap: 8,
      marginTop: 8,
    },
    summaryRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    summaryLabel: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
    },
    summaryValue: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
    },
    positiveValue: {
      color: colors2024['green-default'],
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
    },
    negativeValue: {
      color: colors2024['red-default'],
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
    },
    footer: {
      paddingHorizontal: 4,
      marginTop: 'auto',
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET * 2,
    },
  }),
);
