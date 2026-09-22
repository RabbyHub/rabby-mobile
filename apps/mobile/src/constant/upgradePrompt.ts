import { APP_RUNTIME_ENV, BUILD_CHANNEL } from './env';

export const UPGRADE_PROMPT_URLS = {
  production:
    'https://download.rabby.io/downloads/wallet-mobile-config/upgrade-prompt.json',
  test: 'https://download.rabby.io/downloads/wallet-mobile-config-reg/upgrade-prompt.json',
};

export const UPGRADE_PROMPT_URL =
  APP_RUNTIME_ENV === 'production' && BUILD_CHANNEL !== 'selfhost-reg'
    ? UPGRADE_PROMPT_URLS.production
    : UPGRADE_PROMPT_URLS.test;
