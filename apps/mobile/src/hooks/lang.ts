import { useCallback } from 'react';

import { atom, useAtom, useAtomValue } from 'jotai';
import { atomByMMKV } from '@/core/storage/mmkv';
import i18n, {
  coerceLang,
  filterSupportedLang,
  SupportedLang,
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
