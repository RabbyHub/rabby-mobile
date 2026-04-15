import { isNonPublicProductionEnv } from '@/constant';
import axios from 'axios';
import { merge } from 'lodash';
import { stringUtils } from '@rabby-wallet/base-utils';
import { APP_FILE_LOGGING_ONLINE_SWITCH } from '@/utils/logging/policy';

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
    /** @deprecated keep it disabled online, or the insertions will be error on old version */
    ['20260105.disable_db_prepared_upsert']?: boolean;
    ['20260116.allow_short_auto_lock_time_on_bootstrap']?: boolean;
    ['20260122.enable_db_prepared_upsert']?: boolean;
    [APP_FILE_LOGGING_ONLINE_SWITCH]?: boolean;
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
      '20260122.enable_db_prepared_upsert': false,
      [APP_FILE_LOGGING_ONLINE_SWITCH]: false,
    },
  };
}

const configRef = { current: getDefaultOnlineConfig() };
const listeners = new Set<() => void>();

function notifyOnlineConfigUpdated() {
  listeners.forEach(listener => listener());
}

export async function fetchConfigOnBootstrap() {
  // Fetch the configuration from the appropriate URL
  const response = await axios.get(CONFIG_URL, { timeout: 2000 });
  const json =
    typeof response.data === 'string'
      ? stringUtils.safeParseJSON(response.data)
      : response.data;

  configRef.current = merge(configRef.current, json);
  notifyOnlineConfigUpdated();

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

export function subscribeOnlineConfig(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export async function getLatestOnlineConfig() {
  await firstFetchPromise;

  return configRef.current;
}
