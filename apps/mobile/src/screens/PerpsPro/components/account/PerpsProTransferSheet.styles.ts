import {
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { RoundedFontStyles } from '@/core/utils/fonts';
import type { AppColors2024Variants } from '@/constant/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { colord } from 'colord';
import {
  getPerpsProInputDialogStyles,
  PERPS_PRO_DIALOG_TOKENS,
} from '../common/perpsProDialogVisual';

export const AMOUNT_INPUT_LINE_HEIGHT = 36;

// Dark cards use bg-3 (Figma 87900:97324).
const getTransferCardBackground = (
  colors: AppColors2024Variants,
  isLight: boolean | undefined,
) => colors[isLight === false ? 'neutral-bg-3' : 'neutral-bg-2'];

// Figma 86642:350832: the picked shortcut uses the action mint.
const SHORTCUT_ACTIVE_COLOR = PERPS_PRO_DIALOG_TOKENS.actionBackground;
const SHORTCUT_ACTIVE_BACKGROUND = colord(SHORTCUT_ACTIVE_COLOR)
  .alpha(0.12)
  .toRgbString();

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
      backgroundColor: getTransferCardBackground(colors2024, isLight),
      borderRadius: 12,
      borderCurve: 'continuous',
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
      backgroundColor: getTransferCardBackground(colors2024, isLight),
      borderRadius: 16,
      borderCurve: 'continuous',
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
      lineHeight: AMOUNT_INPUT_LINE_HEIGHT,
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
      borderCurve: 'continuous',
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
      borderCurve: 'continuous',
      flex: 1,
      height: 40,
      justifyContent: 'center',
    },
    shortcutActive: {
      backgroundColor: SHORTCUT_ACTIVE_BACKGROUND,
      borderColor: SHORTCUT_ACTIVE_COLOR,
      borderWidth: 1,
    },
    shortcutDisabled: { opacity: 0.55 },
    shortcutText: {
      color: colors2024['neutral-body'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    },
    shortcutActiveText: {
      color: SHORTCUT_ACTIVE_COLOR,
      ...RoundedFontStyles.bold,
    },
    footer: {
      marginTop: 'auto',
      paddingHorizontal: 4,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET * 2,
    },
  }),
);
