import { useWindowDimensions } from 'react-native';

import type { HeaderTitleLanguageStyle } from './AutoFitHeaderTitle';

/**
 * Screens narrower than this cannot fit the English header title at the base
 * size (QA 1409): an iPhone 13 mini gives the title slot 239pt while
 * `Connect Hardware Wallets` needs 261pt at 20pt, while a 17 Pro gives 266pt.
 */
const NARROW_SCREEN_WIDTH = 390;

/**
 * Languages that keep the adaptive (measured) layout from QA 1352.
 *
 * English is intentionally absent: it is the design baseline and always renders
 * at the base size, one line, tail ellipsis.
 */
const ADAPTIVE_LANGUAGES = [
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

const adaptiveStyles: Record<string, HeaderTitleLanguageStyle> = Object.freeze(
  ADAPTIVE_LANGUAGES.reduce((acc, language) => {
    acc[language] = 'auto';
    return acc;
  }, {} as Record<string, HeaderTitleLanguageStyle>),
);

/** Frozen module-level maps: no new object identity per render. */
export const ADD_WALLET_HEADER_TITLE_STYLES = adaptiveStyles;

/** Narrow screens drop the English title one step so it still fits one line. */
export const ADD_WALLET_HEADER_TITLE_STYLES_NARROW = Object.freeze({
  ...adaptiveStyles,
  'en-US': Object.freeze({
    textStyle: Object.freeze({ fontSize: 18, lineHeight: 22 }),
    numberOfLines: 1 as const,
  }),
});

/**
 * Typography policy for the add-wallet flow headers.
 *
 * The component's default is the English baseline; this hook only adds the
 * exceptions: long languages keep the adaptive layout, and narrow screens drop
 * the English title one step so it stays on one line.
 */
export function useAddWalletHeaderTitleStyles() {
  const { width } = useWindowDimensions();
  return width < NARROW_SCREEN_WIDTH
    ? ADD_WALLET_HEADER_TITLE_STYLES_NARROW
    : ADD_WALLET_HEADER_TITLE_STYLES;
}
