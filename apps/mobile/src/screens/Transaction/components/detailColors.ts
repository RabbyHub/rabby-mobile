import type { AppColors2024Variants } from '@/constant/theme';

/**
 * Surface colors shared by the history detail pages (HistoryDetail and
 * HistoryLocalDetail). The page itself sits on bg-0 (light) / bg-1 (dark).
 */
export function makeHistoryDetailColors({
  isLight,
  colors2024,
}: {
  isLight?: boolean;
  colors2024: AppColors2024Variants;
}) {
  return {
    /** A card placed on the page background. */
    card: isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-3'],
    /** A surface nested inside a card: the address block, the arrow circle. */
    cardInner: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-5'],
    /** The fixed bottom action area; it blends into the page in dark mode. */
    footer: colors2024['neutral-bg-1'],
  };
}
