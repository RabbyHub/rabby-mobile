import { DEV_CONSOLE_URL as DEV_CONSOLE_URL_ } from '@env';

export const APP_RUNTIME_ENV =
  process.env.BUILD_ENV === 'production' ? 'production' : 'development';

export type AppBuildChannel = 'selfhost' | 'selfhost-reg' | 'appstore';
export const BUILD_CHANNEL =
  (process.env.buildchannel as AppBuildChannel) || 'selfhost-reg';
export const DEV_CONSOLE_URL = DEV_CONSOLE_URL_;

export function getSentryEnv() {
  return `ch:${BUILD_CHANNEL}|env:${APP_RUNTIME_ENV}`;
}

export const SENTRY_DEBUG = APP_RUNTIME_ENV === 'development';

export const isSelfhostRegPkg = BUILD_CHANNEL === 'selfhost-reg';
export const NEED_DEVSETTINGBLOCKS = isSelfhostRegPkg || __DEV__;
