import { useCallback, useEffect } from 'react';

import { findBestLanguageTag, getLocales } from 'react-native-localize';
import { useAtom } from 'jotai';
import { atomByMMKV, appStorage } from '@/core/storage/mmkv';
import i18n, {
  coerceLang,
  filterSupportedLang,
  SupportedLang,
  SupportedLangs,
} from '@/utils/i18n';

const langAtom = atomByMMKV<SupportedLang>('@AppLang', 'en' as SupportedLang);

export function useAppLanguage() {
  const [currentLanguage, _setCurrentLanguage] = useAtom(langAtom);

  const setCurrentLanguage = useCallback(
    async (lang: SupportedLang) => {
      const nextVal = filterSupportedLang(lang);
      await i18n.changeLanguage(nextVal);
      _setCurrentLanguage(nextVal);
    },
    [_setCurrentLanguage],
  );

  return {
    currentLanguage: coerceLang(currentLanguage),
    setCurrentLanguage,
  };
}

export function useDetectLanguage() {
  const { setCurrentLanguage } = useAppLanguage();
  useEffect(() => {
    const appLang = appStorage.getItem('@AppLang');

    const langs = SupportedLangs.map(item => item.lang);
    const bestLang = findBestLanguageTag(langs);
    if (appLang) {
      setCurrentLanguage(appLang as unknown as SupportedLang);
    } else if (bestLang) {
      const lang = langs.find(item => item === bestLang.languageTag);
      if (lang) {
        setCurrentLanguage(lang);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
