import { themeColorsNext2024 } from '@rabby-wallet/base-utils/src';
import { useAtomValue } from 'jotai';
import { runtimeInfoAtom } from '../utils/webview-runtime';

export function usePageThemeMode() {
  const runtimeValue = useAtomValue(runtimeInfoAtom);

  const themeMode = runtimeValue.isDark ? 'dark' : ('light' as const);

  return {
    themeMode,
    isLight: !runtimeValue.isDark,
    colors2024: themeColorsNext2024[themeMode],
  };
}

export function usePageI18n() {
  const runtimeValue = useAtomValue(runtimeInfoAtom);

  const i18nTexts = runtimeValue.i18nTexts || {};

  return {
    i18nTexts,
  };
}
