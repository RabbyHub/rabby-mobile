import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enLocale from '@/assets/locales/en/messages.json';
import zh_CNLocale from '@/assets/locales/zh-CN/messages.json';

import codeConfig from '@/assets/locales/index.json';
import { isNonPublicProductionEnv } from '@/constant/env';

export enum SupportedLang {
  'en-US' = 'en-US',
  'zh-CN' = 'zh-CN',
}

const locales = {
  [SupportedLang['en-US']]: enLocale,
  [SupportedLang['zh-CN']]: zh_CNLocale,
};

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

export function coerceLang(lang: SupportedLang): SupportedLang {
  if (isNonPublicProductionEnv) return lang;

  return 'en-US' as SupportedLang;
}

export function filterSupportedLang(lang: string): SupportedLang {
  if (SupportedLang.hasOwnProperty(lang)) {
    return coerceLang(lang as SupportedLang);
  }

  return coerceLang(SupportedLang['en-US']);
}

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    fallbackLng: 'en-US',
    defaultNS: 'translations',
    interpolation: {
      escapeValue: false, // react already safes from xss
      skipOnVariables: true,
    },
    returnNull: false,
  });

export const I18N_NS = 'translations';

export function addResourceBundle(locale: SupportedLang) {
  if (i18n.hasResourceBundle(locale, I18N_NS)) return;
  const bundle = locales[locale];

  i18n.addResourceBundle(locale, I18N_NS, bundle);
}

addResourceBundle('en-US' as SupportedLang);

i18n.on('languageChanged', function (lng: string) {
  addResourceBundle(filterSupportedLang(lng));
});

export default i18n;
