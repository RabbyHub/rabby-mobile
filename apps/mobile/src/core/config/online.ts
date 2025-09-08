import { isNonPublicProductionEnv } from '@/constant/env';
import axios from 'axios';
import { Platform } from 'react-native';
import { merge } from 'lodash';
import { stringUtils } from '@rabby-wallet/base-utils';

const BASE_URL = isNonPublicProductionEnv
  ? 'https://download.rabby.io/downloads/wallet-mobile-config-reg'
  : 'https://download.rabby.io/downloads/wallet-mobile-config';
// const CONFIG_URL = `${BASE_URL}/${Platform.OS === 'android' ? 'android' : 'ios'}.json`;
const CONFIG_URL = `${BASE_URL}/rabby-mobile.json`;

type OnlineConfig = {
  ['switches']?: {
    ['20250820.reportSentry_slowQuery']?: boolean;
  };
};

function getDefaultOnlineConfig(): OnlineConfig {
  return {
    switches: {
      '20250820.reportSentry_slowQuery': false,
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

(() => {
  fetchConfigOnBootstrap().catch(() => {
    console.warn('Failed to fetch online config');
  });

  setInterval(() => {
    fetchConfigOnBootstrap().catch(() => {
      console.warn('Failed to fetch online config');
    });
  }, 5 * 60 * 1e3); // every 5 minutes
})();

export async function getOnlineConfig() {
  return configRef.current;
}
