import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enLocale from '@/assets/locales/en/messages.json';
import zh_CNLocale from '@/assets/locales/zh-CN/messages.json';
import zh_Hant from '@/assets/locales/zh-Hant/messages.json';
import ko_KR from '@/assets/locales/ko-KR/messages.json';
import ja_JP from '@/assets/locales/ja-JP/messages.json';
import th_TH from '@/assets/locales/th-TH/messages.json';
import ru_RU from '@/assets/locales/ru-RU/messages.json';
import vi_VN from '@/assets/locales/vi-VN/messages.json';
import fr_FR from '@/assets/locales/fr-FR/messages.json';
import es_ES from '@/assets/locales/es-ES/messages.json';
import de_DE from '@/assets/locales/de-DE/messages.json';
import pt_PT from '@/assets/locales/pt-PT/messages.json';
import id_ID from '@/assets/locales/id-ID/messages.json';
import tr_TR from '@/assets/locales/tr-TR/messages.json';
import codeConfig from '@/assets/locales/index.json';

export enum SupportedLang {
  'en-US' = 'en-US',
  'zh-CN' = 'zh-CN',
  'zh-Hant' = 'zh-Hant',
  'ko-KR' = 'ko-KR',
  'ja-JP' = 'ja-JP',
  'th-TH' = 'th-TH',
  'ru-RU' = 'ru-RU',
  'vi-VN' = 'vi-VN',
  'fr-FR' = 'fr-FR',
  'es-ES' = 'es-ES',
  'de-DE' = 'de-DE',
  'pt-PT' = 'pt-PT',
  'id-ID' = 'id-ID',
  'tr-TR' = 'tr-TR',
}

export const DEFAULT_LANG = SupportedLang['en-US'];

const locales = {
  [SupportedLang['en-US']]: enLocale,
  [SupportedLang['zh-CN']]: zh_CNLocale,
  [SupportedLang['zh-Hant']]: zh_Hant,
  [SupportedLang['ko-KR']]: ko_KR,
  [SupportedLang['ja-JP']]: ja_JP,
  [SupportedLang['th-TH']]: th_TH,
  [SupportedLang['ru-RU']]: ru_RU,
  [SupportedLang['vi-VN']]: vi_VN,
  [SupportedLang['fr-FR']]: fr_FR,
  [SupportedLang['es-ES']]: es_ES,
  [SupportedLang['de-DE']]: de_DE,
  [SupportedLang['pt-PT']]: pt_PT,
  [SupportedLang['id-ID']]: id_ID,
  [SupportedLang['tr-TR']]: tr_TR,
};

export const SupportedLangs = (
  codeConfig as { code: SupportedLang; name: string }[]
).reduce(
  (accu, item) => {
    if (SupportedLang.hasOwnProperty(item.code)) {
      accu.push({ lang: item.code, label: item.name, isRTL: false });
    }

    return accu;
  },
  [] as {
    isRTL: boolean;
    lang: SupportedLang;
    label: string;
  }[],
);

export function filterSupportedLang(lang: string): SupportedLang {
  if (SupportedLang.hasOwnProperty(lang)) {
    return lang as SupportedLang;
  }

  return DEFAULT_LANG;
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

/** @deprecated use `i18n.t` directly */
export function strings(...args: Parameters<typeof i18n.t>) {
  return i18n.t(...args);
}
