import type { AppColors2024Variants } from '@/constant/theme';
import {
  BOTTOM_BUTTON_TITLE_STYLE,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { getPerpsProBottomSheetChromeStyles } from './perpsProVisual';

// mutateStyles selects the bundled Android Heavy face with 900; iOS uses
// SF Pro Rounded's native Heavy weight (800). Keep the family unprocessed here.
export const PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE = {
  fontFamily: 'SF Pro Rounded',
  fontWeight: IS_ANDROID ? ('900' as const) : ('800' as const),
};

/** Exact Figma paints approved for Pro only (cNPc4bz8P8QBjkPk2huEml).
 * Selected card: 83964:183450; button/text: 83973:85097/85098;
 * cursor: 83973:131112; checkbox Gray/3: 83973:85524.
 * Neutral/semantic colors stay on theme tokens.
 */
export const PERPS_PRO_DIALOG_TOKENS = {
  actionBackground: '#23C0B0',
  actionForeground: '#040601',
  inputCursor: '#23C0B0',
  selectedBackground: 'rgba(80, 210, 193, 0.1)',
  selectedBorder: 'rgba(35, 192, 176, 0.4)',
  checkboxBorder: '#DDDFE4',
  // Existing Pro Transfer shadow, also present on the new Figma action.
  actionShadow: 'rgba(112, 132, 255, 0.1)',
} as const;

/** September dialog geometry; legacy Pro sheets keep their existing defaults. */
export const getPerpsProDialogStyles = (
  colors: AppColors2024Variants,
  bottomInset: number,
) =>
  ({
    ...getPerpsProBottomSheetChromeStyles(colors, {
      backgroundColor: colors['neutral-bg-0'],
    }),
    modal: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    background: {
      backgroundColor: colors['neutral-bg-0'],
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handle: {
      backgroundColor: colors['neutral-bg-0'],
      height: 40,
      paddingTop: 10,
      paddingBottom: 23.727184,
    },
    handleIndicator: {
      backgroundColor: colors['neutral-sheet-handle'],
      width: 50.182529,
      height: 6.272816,
      borderRadius: 3.136408,
    },
    sheet: {},
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: getBottomButtonBottomOffset(bottomInset),
    },
    title: {
      ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
      color: colors['neutral-title-1'],
      fontSize: 20,
      lineHeight: 24,
      textAlign: 'center',
    },
    options: { gap: 8, marginTop: 24 },
    option: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 15,
      backgroundColor: colors['neutral-bg-1'],
    },
    optionActive: {
      backgroundColor: PERPS_PRO_DIALOG_TOKENS.selectedBackground,
      borderColor: PERPS_PRO_DIALOG_TOKENS.selectedBorder,
    },
    optionInactive: { borderColor: 'transparent' },
    copy: { alignSelf: 'stretch', gap: 8, minWidth: 0 },
    label: {
      color: colors['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    },
    description: {
      color: colors['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
    },
    button: {
      borderRadius: 12,
      backgroundColor: PERPS_PRO_DIALOG_TOKENS.actionBackground,
      shadowColor: PERPS_PRO_DIALOG_TOKENS.actionShadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonDisabled: { backgroundColor: colors['brand-disable'] },
    buttonDisabledTitle: { color: colors['neutral-InvertHighlight'] },
    buttonTitle: {
      ...BOTTOM_BUTTON_TITLE_STYLE,
      fontFamily: 'SF Pro Rounded',
      color: PERPS_PRO_DIALOG_TOKENS.actionForeground,
    },
  } as const);
