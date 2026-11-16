import {
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { RoundedFontStyles } from '@/core/utils/fonts';
import { createGetStyles2024 } from '@/utils/styles';
import { getPerpsProInputDialogStyles } from '../common/perpsProDialogVisual';

// Figma 86313:146099: bg-1 sheet, 17pt section titles and bg-2 inputs.
export const getPerpsProTransferSheetStyles = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProInputDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    sheetView: { height: '100%' },
    container: { height: '100%', paddingHorizontal: 16, paddingTop: 8 },
    content: { gap: 20, marginTop: 24 },
    section: { gap: 8 },
    sectionLabel: {
      color: colors2024['neutral-title-1'],
      ...RoundedFontStyles.bold,
      fontSize: 17,
      lineHeight: 22,
    },
    sectionHeader: { paddingHorizontal: 4 },
    directionCard: {
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 12,
      height: 92,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    directionRow: { alignItems: 'center', flexDirection: 'row', height: 42 },
    directionLabel: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      width: 59,
    },
    directionValue: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    },
    amountHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    balance: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
    },
    amountField: {
      alignItems: 'center',
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 16,
      flexDirection: 'row',
      height: 76,
      paddingHorizontal: 16,
    },
    amountInput: {
      color: colors2024['neutral-title-1'],
      ...RoundedFontStyles.bold,
      flex: 1,
      fontSize: 28,
      height: 76,
      lineHeight: 36,
      minWidth: 0,
      padding: 0,
    },
    tokenDivider: {
      backgroundColor: colors2024['neutral-line'],
      height: 27.5,
      marginLeft: 8,
      width: 1,
    },
    tokenPill: {
      alignItems: 'center',
      backgroundColor: colors2024['neutral-line'],
      borderRadius: 100,
      flexDirection: 'row',
      gap: 2,
      marginLeft: 12,
      padding: 4,
    },
    tokenText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    },
    shortcuts: { flexDirection: 'row', gap: 8 },
    shortcut: {
      alignItems: 'center',
      backgroundColor: colors2024['neutral-bg-5'],
      borderRadius: 6,
      flex: 1,
      height: 40,
      justifyContent: 'center',
    },
    shortcutDisabled: { opacity: 0.55 },
    shortcutText: {
      color: colors2024['neutral-body'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    },
    footer: {
      marginTop: 'auto',
      paddingHorizontal: 4,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET * 2,
    },
  }),
);
