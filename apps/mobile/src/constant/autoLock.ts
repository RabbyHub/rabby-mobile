import { t } from 'i18next';
import { isNonPublicProductionEnv } from '.';
import { getLatestOnlineConfig } from '@/core/config/online';
export const TIME_SETTINGS: {
  key: string;
  getLabel: () => string;
  milliseconds: number;
}[] = [
  {
    key: '24h',
    getLabel: () => t('global.time.hours', { t: 24 }),
    milliseconds: 24 * 60 * 60 * 1000,
  },
  {
    key: '12h',
    getLabel: () => t('global.time.hours', { t: 12 }),
    milliseconds: 12 * 60 * 60 * 1000,
  },
  {
    key: '4h',
    getLabel: () => t('global.time.hours', { t: 4 }),
    milliseconds: 4 * 60 * 60 * 1000,
  },
  {
    key: '1h',
    getLabel: () => t('global.time.hour', { t: 1 }),
    milliseconds: 60 * 60 * 1000,
  },
  {
    key: '10m',
    getLabel: () => t('global.time.mins', { t: 10 }),
    milliseconds: 10 * 60 * 1000,
  },
  {
    key: '5m',
    getLabel: () => t('global.time.mins', { t: 5 }),
    milliseconds: 5 * 60 * 1000,
  },
  {
    key: 'never',
    getLabel: () => t('global.autolock.never'),
    milliseconds: -1,
  },
];

function pushShortAutoLockTimeSetting() {
  TIME_SETTINGS.push({
    key: '1m',
    getLabel: () => '1 minute (DEV ONLY)',
    milliseconds: 60 * 1000,
  });
  TIME_SETTINGS.push({
    key: '30s',
    getLabel: () => '30 seconds (DEV ONLY)',
    milliseconds: 30 * 1000,
  });
}
if (__DEV__) {
  pushShortAutoLockTimeSetting();
} else if (isNonPublicProductionEnv) {
  getLatestOnlineConfig().then(config => {
    if (config.switches?.['20260116.allow_short_auto_lock_time_on_bootstrap']) {
      pushShortAutoLockTimeSetting();
    }
  });
}

export const DEFAULT_AUTO_LOCK_MINUTES = Math.floor(
  TIME_SETTINGS.find(item => item.key === '24h')!.milliseconds / (1000 * 60),
);
