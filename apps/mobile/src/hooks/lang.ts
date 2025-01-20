import { useCallback, useMemo } from 'react';

import { findBestLanguageTag, getLocales } from 'react-native-localize';
import { useAtom } from 'jotai';
import { atomByMMKV, appJsonStore } from '@/core/storage/mmkv';
import i18n, {
  DEFAULT_LANG,
  filterSupportedLang,
  SupportedLang,
  SupportedLangs,
} from '@/utils/i18n';
import useMount from 'react-use/lib/useMount';
import { isNonPublicProductionEnv } from '@/constant/env';

function filterOutBestLang() {
  const langs = SupportedLangs.map(item => item.lang);
  return findBestLanguageTag(langs);
}

let defaultLang = filterOutBestLang()?.languageTag || DEFAULT_LANG;
(function iifeUpgradeAppLang() {
  // leave here for test fresh user
  if (!isNonPublicProductionEnv) {
    appJsonStore.removeItem('@AppLangSetting');
    appJsonStore.removeItem('@AppLang');
  }

  // // leave here for test legacy data
  // if (!isNonPublicProductionEnv) {
  //   appJsonStore.setItem('@AppLang', 'en');
  // }

  const legacyAppLang = appJsonStore.getItem('@AppLang', null) as SupportedLang;
  if (legacyAppLang) {
    appJsonStore.removeItem('@AppLang');
    defaultLang = coerceLang(legacyAppLang) || defaultLang;
    console.debug(
      `[iifeUpgradeAppLang] legacy app lang: ${legacyAppLang}; default lang: ${defaultLang}`,
    );
  }
})();

function coerceLang(lang: string): SupportedLang {
  switch (lang) {
    case 'en':
    case 'en-US':
      return 'en-US' as SupportedLang;
    case 'zh':
    case 'zh-CN':
      return 'zh-CN' as SupportedLang;
    default:
      return filterSupportedLang(lang);
  }
}

type LangSetting = {
  lang: SupportedLang;
  isRTL?: boolean;
};
function makeLangSetting(lang: SupportedLang): LangSetting {
  return { lang: filterSupportedLang(lang), isRTL: false };
}

const langAtom = atomByMMKV<{
  lang: SupportedLang;
  isRTL?: boolean;
}>('@AppLangSetting', makeLangSetting(defaultLang));

export function useAppLanguage() {
  const [currentLangSetting, _setCurrentLangSetting] = useAtom(langAtom);

  const setCurrentLanguage = useCallback(
    async (lang: SupportedLang) => {
      const nextVal = filterSupportedLang(lang);
      await i18n.changeLanguage(nextVal);
      _setCurrentLangSetting(makeLangSetting(nextVal));
    },
    [_setCurrentLangSetting],
  );

  const currentLanguage = useMemo(
    () => filterSupportedLang(currentLangSetting.lang),
    [currentLangSetting.lang],
  );

  return {
    currentLanguage,
    setCurrentLanguage,
  };
}

/**
 * @description only call this hook once in the app
 */
export function useTriggerI18nChangeOnAppTop() {
  const { currentLanguage } = useAppLanguage();

  useMount(() => {
    i18n
      .changeLanguage(currentLanguage)
      .then(() => {
        console.debug(
          `[useTriggerI18nChangeOnAppTop] current language: ${currentLanguage}`,
        );
      })
      .catch(error => {
        console.error(error);
      });
  });
}
