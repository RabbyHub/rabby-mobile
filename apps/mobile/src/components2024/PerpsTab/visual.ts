import type { AppColors2024Variants } from '@/constant/theme';

/** Figma "导航 Tab" spec (cNPc4bz8P8QBjkPk2huEml 76776:613508), shared by the
 * market selector, info and history tabs. Strip geometry stays per surface.
 */
export const PERPS_PRO_TAB_TOKENS = {
  indicatorColor: '#23C0B0',
  indicatorHeight: 3,
  // The 3pt round-cap stroke ends 0.5pt above the divider's center line.
  indicatorBottom: 0.5,
  // Round caps extend half the stroke beyond each text edge.
  indicatorCapInset: 1.5,
} as const;

export const getPerpsProTabTextStyle = (colors: AppColors2024Variants) =>
  ({
    color: colors['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  } as const);

export const getPerpsProTabIndicatorStyle = () =>
  ({
    backgroundColor: PERPS_PRO_TAB_TOKENS.indicatorColor,
    borderRadius: PERPS_PRO_TAB_TOKENS.indicatorHeight / 2,
    bottom: PERPS_PRO_TAB_TOKENS.indicatorBottom,
    height: PERPS_PRO_TAB_TOKENS.indicatorHeight,
  } as const);

export const getPerpsProTabDividerColor = (colors: AppColors2024Variants) =>
  colors['neutral-bg-5'];

/** Market category strips in both Simple and Pro (Figma 86609:237010). */
export const PERPS_MARKET_TAB_LAYOUT = {
  gap: 14,
  paddingHorizontal: 20,
  height: 42,
  paddingTop: 12,
} as const;
