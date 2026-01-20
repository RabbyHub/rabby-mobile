import { isNonPublicProductionEnv } from '@/constant';
import axios from 'axios';
import { Platform } from 'react-native';
import { merge } from 'lodash';
import { stringUtils } from '@rabby-wallet/base-utils';

function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const BASE_URL = isNonPublicProductionEnv
  ? 'https://download.rabby.io/downloads/wallet-mobile-config-reg'
  : 'https://download.rabby.io/downloads/wallet-mobile-config';
// const CONFIG_URL = `${BASE_URL}/${Platform.OS === 'android' ? 'android' : 'ios'}.json`;
const CONFIG_URL = `${BASE_URL}/rabby-mobile.json`;

type OnlineConfig = {
  ['switches']?: {
    ['20250820.reportSentry_slowQuery']?: boolean;
    ['20250924.android_webview_always_treat_as_reload']?: boolean;
    ['20251226.enable_worker_thread']?: boolean;
    ['20260105.disable_db_prepared_upsert']?: boolean;
    ['20260116.allow_short_auto_lock_time_on_bootstrap']?: boolean;
  };
};

function getDefaultOnlineConfig(): OnlineConfig {
  return {
    switches: {
      '20250820.reportSentry_slowQuery': false,
      '20250924.android_webview_always_treat_as_reload': true,
      '20251226.enable_worker_thread': false,
      '20260105.disable_db_prepared_upsert': false,
      '20260116.allow_short_auto_lock_time_on_bootstrap': false,
    },
  };
}

const configRef = { current: getDefaultOnlineConfig() };

export async function fetchConfigOnBootstrap() {
  // Fetch the configuration from the appropriate URL
  const response = await axios.get(CONFIG_URL, { timeout: 2000 });
  const json =
    typeof response.data === 'string'
      ? stringUtils.safeParseJSON(response.data)
      : response.data;

  configRef.current = merge(configRef.current, json);

  return json as Partial<OnlineConfig> | undefined;
}

const firstFetchPromise = Promise.race([
  fetchConfigOnBootstrap().catch(() => {
    console.warn('Failed to fetch online config');
  }),
  sleep(5000),
]);

export function startSyncOnlineConfig() {
  firstFetchPromise;

  setInterval(() => {
    fetchConfigOnBootstrap().catch(() => {
      console.warn('Failed to fetch online config');
    });
  }, 5 * 60 * 1e3); // every 5 minutes
}

export function getOnlineConfig() {
  return configRef.current;
}

export async function getLatestOnlineConfig() {
  await firstFetchPromise;

  return configRef.current;
}
