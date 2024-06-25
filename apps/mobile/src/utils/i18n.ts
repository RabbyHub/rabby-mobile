import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enLocale from '@/assets/locales/en/messages.json';

export function getLocale(locale: string) {
  // ONLY support en for now
  return enLocale;
}

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    compatibilityJSON: 'v3',
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

export function addResourceBundle(locale: string) {
  if (i18n.hasResourceBundle(locale, I18N_NS)) return;
  const bundle = getLocale(locale);

  i18n.addResourceBundle(locale, I18N_NS, bundle);
}

addResourceBundle('en');

i18n.on('languageChanged', function (lng) {
  addResourceBundle(lng);
});

export default i18n;
