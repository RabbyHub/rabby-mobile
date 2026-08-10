import { isNonPublicProductionEnv } from '@/constant';
import axios from 'axios';
import { merge } from 'lodash';
import { stringUtils } from '@rabby-wallet/base-utils';
import { APP_FILE_LOGGING_ONLINE_SWITCH } from '@/utils/logging/policy';
import { appMMKV } from '../storage/mmkvInstances';

const BASE_URL = isNonPublicProductionEnv
  ? 'https://download.rabby.io/downloads/wallet-mobile-config-reg'
  : 'https://download.rabby.io/downloads/wallet-mobile-config';
// const CONFIG_URL = `${BASE_URL}/${Platform.OS === 'android' ? 'android' : 'ios'}.json`;
const CONFIG_URL = `${BASE_URL}/rabby-mobile.json`;
export const ONLINE_SWITCH_ENABLE_WORKER_THREAD =
  '20251226.enable_worker_thread' as const;
const ONLINE_CONFIG_CACHE_KEY = '@OnlineConfigCacheV1';
const ONLINE_CONFIG_CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

type OnlineConfig = {
  ['switches']?: {
    ['20250820.reportSentry_slowQuery']?: boolean;
    ['20250924.android_webview_always_treat_as_reload']?: boolean;
    [ONLINE_SWITCH_ENABLE_WORKER_THREAD]?: boolean;
    /** @deprecated keep it disabled online, or the insertions will be error on old version */
    ['20260105.disable_db_prepared_upsert']?: boolean;
    ['20260116.allow_short_auto_lock_time_on_bootstrap']?: boolean;
    ['20260122.enable_db_prepared_upsert']?: boolean;
    [APP_FILE_LOGGING_ONLINE_SWITCH]?: boolean;
  };
};

type CachedOnlineConfig = {
  version: 1;
  updateTime: number;
  config: Partial<OnlineConfig>;
};

function getDefaultOnlineConfig(): OnlineConfig {
  return {
    switches: {
      '20250820.reportSentry_slowQuery': false,
      '20250924.android_webview_always_treat_as_reload': true,
      [ONLINE_SWITCH_ENABLE_WORKER_THREAD]: false,
      '20260105.disable_db_prepared_upsert': false,
      '20260116.allow_short_auto_lock_time_on_bootstrap': false,
      '20260122.enable_db_prepared_upsert': false,
      [APP_FILE_LOGGING_ONLINE_SWITCH]: false,
    },
  };
}

function readCachedOnlineConfig(): Partial<OnlineConfig> | undefined {
  const raw = appMMKV.getString(ONLINE_CONFIG_CACHE_KEY);
  if (!raw) {
    return undefined;
  }

  const cached = stringUtils.safeParseJSON<CachedOnlineConfig>(raw, {
    defaultValue: null,
  });
  if (!cached?.config || cached.version !== 1) {
    appMMKV.delete(ONLINE_CONFIG_CACHE_KEY);
    return undefined;
  }

  if (Date.now() - cached.updateTime > ONLINE_CONFIG_CACHE_MAX_AGE_MS) {
    appMMKV.delete(ONLINE_CONFIG_CACHE_KEY);
    return undefined;
  }

  return cached.config;
}

function writeCachedOnlineConfig(config: Partial<OnlineConfig> | undefined) {
  if (!config) {
    return;
  }

  appMMKV.set(
    ONLINE_CONFIG_CACHE_KEY,
    JSON.stringify({
      version: 1,
      updateTime: Date.now(),
      config,
    } satisfies CachedOnlineConfig),
  );
}

const configRef = {
  current: merge(getDefaultOnlineConfig(), readCachedOnlineConfig()),
};
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
  writeCachedOnlineConfig(json);
  notifyOnlineConfigUpdated();

  return json as Partial<OnlineConfig> | undefined;
}

async function fetchFirstOnlineConfig() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<void>(resolve => {
    timeoutId = setTimeout(resolve, 5000);
  });

  try {
    return await Promise.race([
      fetchConfigOnBootstrap().catch(() => {
        console.warn('Failed to fetch online config');
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

const firstFetchPromise = fetchFirstOnlineConfig();

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

export function isOnlineWorkerThreadEnabled(config = configRef.current) {
  return !!config.switches?.[ONLINE_SWITCH_ENABLE_WORKER_THREAD];
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
