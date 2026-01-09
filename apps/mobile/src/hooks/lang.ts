import { useCallback, useEffect, useMemo } from 'react';

import { findBestLanguageTag } from 'react-native-localize';
import { useAtom } from 'jotai';
import {
  atomByMMKV,
  duplicatelyStringifiedAppJsonStore,
  IS_BOOTED_USER,
  MMKVStorageStrategy,
  zustandByMMKV,
} from '@/core/storage/mmkv';
import i18n, {
  DEFAULT_LANG,
  filterSupportedLang,
  SupportedLang,
  SupportedLangs,
} from '@/utils/i18n';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

function filterOutBestLang() {
  const langs = SupportedLangs.map(item => item.lang);
  return findBestLanguageTag(langs);
}

let defaultLang = filterOutBestLang()?.languageTag || DEFAULT_LANG;
/**
 * @notice
 * - users with version<0.5.4 has '@AppLang' in storage, because this file is not lazy-loaded
 * - users STARTING from 0.5.4~0.5.5 has no opportunity to set lang, so the '@AppLang' is always null
 */
(function iifeUpgradeAppLang() {
  const currentAppLangSetting = duplicatelyStringifiedAppJsonStore.getItem(
    '@AppLangSetting',
    null,
  );
  let legacyAppLang = duplicatelyStringifiedAppJsonStore.getItem(
    '@AppLang',
    null,
  ) as string;
  // for all used user, set default lang
  if (!currentAppLangSetting && IS_BOOTED_USER && !legacyAppLang) {
    duplicatelyStringifiedAppJsonStore.setItem('@AppLang', 'en');
    legacyAppLang = 'en';
  }
  // // leave here for test fresh user
  // if (__DEV__) {
  //   duplicatelyStringifiedAppJsonStore.removeItem('@AppLangSetting');
  //   duplicatelyStringifiedAppJsonStore.removeItem('@AppLang');
  // }

  // // leave here for test legacy data
  // if (__DEV__) {
  //   duplicatelyStringifiedAppJsonStore.setItem('@AppLang', 'en');
  // }

  if (legacyAppLang) {
    duplicatelyStringifiedAppJsonStore.removeItem('@AppLang');
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

const langStore = zustandByMMKV<{
  lang: SupportedLang;
  isRTL?: boolean;
}>('@AppLangSetting', makeLangSetting(defaultLang), {
  storage: MMKVStorageStrategy.compatJson,
});

function gSetCurrentLanguage(valOrFunc: UpdaterOrPartials<LangSetting>) {
  langStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);

    return newVal;
  });
}

const setCurrentLanguage = async (lang: SupportedLang) => {
  const nextVal = filterSupportedLang(lang);
  await i18n.changeLanguage(nextVal);
  gSetCurrentLanguage(makeLangSetting(nextVal));
};

export function useAppLanguage() {
  const lang = langStore(s => s.lang);

  const currentLanguage = useMemo(() => filterSupportedLang(lang), [lang]);

  return {
    currentLanguage,
    setCurrentLanguage,
  };
}

function i18nChange(lang: SupportedLang) {
  i18n
    .changeLanguage(filterSupportedLang(lang))
    .then(() => {
      console.debug(`[useTriggerI18nChangeOnAppTop] current language: ${lang}`);
    })
    .catch(error => {
      console.error(error);
    });
}

export function startSubscribeLangChange() {
  i18nChange(langStore.getState().lang);
  langStore.subscribe(async state => {
    i18nChange(state.lang);
  });
}
