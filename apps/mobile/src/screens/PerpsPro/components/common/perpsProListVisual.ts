import { RoundedFontStyles } from '@/core/utils/fonts';
import type { AppColors2024Variants } from '@/constant/theme';

/** Figma list and card specs (cNPc4bz8P8QBjkPk2huEml): history card
 * 86313:138628, position 86609:329983, open orders 86609:327840.
 */
export const PERPS_PRO_CARD_SHADOW = '0px 5px 20px 0px rgba(0, 0, 0, 0.08)';

// Dark mode cards use bg-2 without a shadow (design note on 86609:329983).
export const getPerpsProInfoCardStyle = (
  colors: AppColors2024Variants,
  isLight: boolean | undefined,
) =>
  ({
    backgroundColor:
      colors[isLight === false ? 'neutral-bg-2' : 'neutral-bg-1'],
    borderRadius: 12,
    padding: 12,
    ...(isLight === false ? null : { boxShadow: PERPS_PRO_CARD_SHADOW }),
  } as const);

/** 30pt label/value rows shared by Pro cards and dialogs. */
export const getPerpsProListRowStyles = (colors: AppColors2024Variants) =>
  ({
    listRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    listLabel: {
      color: colors['neutral-secondary'],
      ...RoundedFontStyles.medium,
      fontSize: 14,
      lineHeight: 18,
    },
    listValue: {
      color: colors['neutral-title-1'],
      ...RoundedFontStyles.bold,
      fontSize: 14,
      lineHeight: 18,
    },
  } as const);

/** Dialog card holding 30pt list rows (Figma 86313:149961): rows carry the
 * vertical rhythm, so the card adds 12pt above and 8pt below.
 */
export const PERPS_PRO_DIALOG_LIST_CARD_PADDING = {
  paddingBottom: 8,
  paddingHorizontal: 16,
  paddingTop: 12,
} as const;
