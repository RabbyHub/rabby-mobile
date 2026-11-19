import type { HeaderTitleLanguageStyle } from '@/components/AutoFitHeaderTitle';

/**
 * Languages whose header titles keep the adaptive (measured) layout from QA
 * 1352: they may fall back to the compact two-line stage when the translation
 * does not fit. English is the design baseline and never takes part in it.
 */
const ADAPTIVE_TITLE_LANGUAGES = [
  'zh-CN',
  'zh-Hant',
  'ko-KR',
  'ja-JP',
  'th-TH',
  'ru-RU',
  'vi-VN',
  'fr-FR',
  'es-ES',
  'de-DE',
  'pt-PT',
  'id-ID',
  'tr-TR',
] as const;

export type HeaderTitleWidthStep = {
  /** Widest title slot (pt) that still needs this step. */
  maxAvailableWidth: number;
  fontSize: number;
  lineHeight: number;
};

/**
 * Static width ladder for English header titles that cannot fit at the 20pt
 * baseline on narrow iOS title slots.
 *
 * Only titles measured to overflow belong here; everything else keeps the
 * 20/24 baseline on every screen. Values come from the real SF Pro Rounded
 * Heavy metrics:
 *
 * - `Connect Hardware Wallets` = ~261pt at 20pt.
 * - `Restore your Rabby wallet` = ~254pt at 20pt.
 * - Every other English title in this flow measures <= 225pt at 20pt, so they
 *   keep the 20pt baseline without an entry here.
 * - The current header layout gives the title `windowWidth - 96` on iOS (16pt
 *   insets x2, 32pt symmetric side slots x2, 8pt margins x2): 375 -> 279,
 *   393 -> 297, 402 -> 306. Both long titles therefore fit at 20pt everywhere
 *   today; the steps below are the guard for an even narrower slot.
 */
const HEADER_TITLE_WIDTH_STEPS: Partial<
  Record<string, readonly HeaderTitleWidthStep[]>
> = {
  'screens.addressStackTitle.ImportHardwareAddress': [
    { maxAvailableWidth: 247.9, fontSize: 18, lineHeight: 22 },
    { maxAvailableWidth: 260.9, fontSize: 19, lineHeight: 23 },
  ],
  'page.newUserOnboarding.restoreWallet.title': [
    { maxAvailableWidth: 253.9, fontSize: 18, lineHeight: 22 },
  ],
};

export type HeaderTitleTypographyInput = {
  /** i18n key of the title, e.g. `screens.addressStackTitle.ImportHardwareAddress`. */
  titleKey?: string;
  /** Resolved app language, e.g. `en-US`. */
  language?: string;
  /** Width actually available to the title glyphs, in pt. */
  availableWidth: number;
};

/**
 * Resolve the typography policy for a header title.
 *
 * - adaptive languages keep the measured two-line behaviour (`'auto'`);
 * - English only steps down when its title has a recorded width ladder and the
 *   current slot is narrower than the measured 20pt glyph width;
 * - every other case returns `undefined`, which is the 20pt/one-line baseline.
 *
 * The function is synchronous and side-effect free: callers pass the live
 * window width and language from `useTheme2024`, so the first render already
 * uses the final metrics (no measuring pass, no visible size change).
 */
export function resolveHeaderTitleLanguageStyle({
  titleKey,
  language,
  availableWidth,
}: HeaderTitleTypographyInput): HeaderTitleLanguageStyle | undefined {
  if (
    language &&
    (ADAPTIVE_TITLE_LANGUAGES as readonly string[]).includes(language)
  ) {
    return 'auto';
  }

  if (language !== 'en-US' || !titleKey) {
    return undefined;
  }

  const steps = HEADER_TITLE_WIDTH_STEPS[titleKey];
  if (!steps) {
    return undefined;
  }

  const step = steps.find(item => availableWidth <= item.maxAvailableWidth);
  if (!step) {
    return undefined;
  }

  return {
    textStyle: { fontSize: step.fontSize, lineHeight: step.lineHeight },
    numberOfLines: 1,
    ellipsizeMode: 'tail',
  };
}
