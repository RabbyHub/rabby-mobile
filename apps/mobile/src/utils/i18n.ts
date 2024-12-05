import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enLocale from '@/assets/locales/en/messages.json';
import zh_CNLocale from '@/assets/locales/zh-CN/messages.json';

import codeConfig from '@/assets/locales/index.json';

export enum SupportedLang {
  'en' = 'en',
  'zh-CN' = 'zh-CN',
}

export const SupportedLangs = (
  codeConfig as { code: SupportedLang; name: string }[]
).reduce(
  (accu, item) => {
    if (SupportedLang.hasOwnProperty(item.code)) {
      accu.push({ lang: item.code, label: item.name });
    }

    return accu;
  },
  [] as {
    lang: SupportedLang;
    label: string;
  }[],
);

export function filterSupportedLang(lang: string): SupportedLang {
  if (SupportedLang.hasOwnProperty(lang)) {
    return lang as SupportedLang;
  }

  return SupportedLang.en;
}

export function getLocale(locale: SupportedLang) {
  // ONLY support en for now
  switch (locale) {
    default:
    case SupportedLang.en:
      return enLocale;
    case SupportedLang['zh-CN']:
      return zh_CNLocale;
  }
}

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    fallbackLng: 'en',
    defaultNS: 'translations',
    interpolation: {
      escapeValue: false, // react already safes from xss
      skipOnVariables: true,
    },
    returnNull: false,
  });

export const I18N_NS = 'translations';

export function strings(...args: Parameters<typeof i18n.t>) {
  return i18n.t(...args);
}

export function addResourceBundle(locale: SupportedLang) {
  if (i18n.hasResourceBundle(locale, I18N_NS)) return;
  const bundle = getLocale(locale);

  i18n.addResourceBundle(locale, I18N_NS, bundle);
}

addResourceBundle('en' as SupportedLang);

i18n.on('languageChanged', function (lng: string) {
  addResourceBundle(filterSupportedLang(lng));
});

export default i18n;
