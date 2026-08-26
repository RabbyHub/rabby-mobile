import {
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { FontNames } from '@/core/utils/fonts';
import { createGetStyles2024 } from '@/utils/styles';

import {
  getPerpsProBottomSheetChromeStyles,
  resolvePerpsProFieldBackground,
} from '../common/perpsProVisual';

const PERPS_PRO_TRANSFER_BOTTOM_OFFSET = 30;
const PERPS_PRO_TRANSFER_BUTTON_SHADOW = 'rgba(112, 132, 255, 0.1)';

export const getPerpsProTransferSheetStyles = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => {
    const chrome = getPerpsProBottomSheetChromeStyles(colors2024);
    return {
      ...chrome,
      sheetView: { height: '100%' },
      container: { height: '100%', paddingHorizontal: 15, paddingTop: 8 },
      title: {
        color: colors2024['neutral-title-1'],
        fontFamily: FontNames.sf_pro,
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
      },
      content: { gap: 24, marginTop: 16 },
      section: { gap: 8 },
      sectionLabel: {
        color: colors2024['neutral-body'],
        fontFamily: FontNames.sf_pro,
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
      },
      directionCard: {
        backgroundColor: resolvePerpsProFieldBackground({
          darkBackground: colors2024['neutral-bg-2'],
          isLight,
        }),
        borderRadius: 6,
        height: 76,
        justifyContent: 'center',
        paddingHorizontal: 8,
        position: 'relative',
      },
      directionRow: { alignItems: 'center', flexDirection: 'row', height: 34 },
      directionLabel: {
        color: colors2024['neutral-foot'],
        fontFamily: FontNames.sf_pro,
        fontSize: 12,
        lineHeight: 16,
        width: 41,
      },
      directionValue: {
        color: colors2024['neutral-title-1'],
        fontFamily: FontNames.sf_pro,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 18,
      },
      directionIcon: {
        alignItems: 'center',
        height: 16,
        justifyContent: 'center',
        position: 'absolute',
        right: 16,
        top: 30,
        transform: [{ rotate: '90deg' }],
        width: 16,
      },
      amountHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingRight: 13,
      },
      balance: {
        color: colors2024['neutral-body'],
        fontFamily: FontNames.sf_pro,
        fontSize: 12,
        lineHeight: 16,
      },
      amountField: {
        alignItems: 'center',
        backgroundColor: resolvePerpsProFieldBackground({
          darkBackground: colors2024['neutral-bg-2'],
          isLight,
        }),
        borderRadius: 6,
        flexDirection: 'row',
        height: 72,
        paddingHorizontal: 16,
      },
      amountInput: {
        color: colors2024['neutral-title-1'],
        flex: 1,
        fontFamily: FontNames.sf_pro,
        fontSize: 28,
        fontWeight: '700',
        height: 72,
        lineHeight: 36,
        minWidth: 0,
        padding: 0,
      },
      tokenPill: {
        alignItems: 'center',
        borderColor: colors2024['neutral-info'],
        borderRadius: 8,
        borderWidth: 0.5,
        flexDirection: 'row',
        gap: 6,
        height: 40,
        justifyContent: 'center',
        marginLeft: 8,
        paddingHorizontal: 12,
        width: 100,
      },
      tokenIcon: { height: 24, width: 24 },
      tokenText: {
        color: colors2024['neutral-title-1'],
        fontFamily: FontNames.sf_pro,
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 20,
      },
      shortcuts: { flexDirection: 'row', gap: 8, paddingLeft: 3 },
      shortcut: {
        alignItems: 'center',
        backgroundColor: resolvePerpsProFieldBackground({
          darkBackground: colors2024['neutral-bg-2'],
          isLight,
        }),
        borderRadius: 6,
        flex: 1,
        height: 40,
        justifyContent: 'center',
      },
      shortcutDisabled: { opacity: 0.55 },
      shortcutText: {
        color: colors2024['neutral-title-1'],
        fontFamily: FontNames.sf_pro,
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
      },
      confirmButton: {
        borderRadius: 8,
        elevation: 4,
        shadowColor: PERPS_PRO_TRANSFER_BUTTON_SHADOW,
        shadowOffset: { height: 8, width: 0 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      footer: {
        marginTop: 'auto',
        paddingBottom:
          getBottomButtonBottomOffset(safeAreaInsets.bottom) -
          (BOTTOM_BUTTON_BOTTOM_OFFSET - PERPS_PRO_TRANSFER_BOTTOM_OFFSET),
        paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
      },
    };
  },
);
