import {
  DEV_CONSOLE_URL as DEV_CONSOLE_URL_,
  RABBY_MOBILE_SAFE_API_KEY as RABBY_MOBILE_SAFE_API_KEY_,
} from '@env';

export const APP_RUNTIME_ENV = __DEV__
  ? 'development'
  : process.env.RABBY_MOBILE_BUILD_ENV === 'production'
  ? 'production'
  : 'regression';

export type AppBuildChannel = 'selfhost' | 'selfhost-reg' | 'appstore';
export const BUILD_CHANNEL =
  (process.env.buildchannel as AppBuildChannel) || 'selfhost-reg';
export const DEV_CONSOLE_URL = DEV_CONSOLE_URL_;

const INPUT_BUILD_GIT_INFO =
  typeof process.env.BUILD_GIT_INFO === 'object'
    ? process.env.BUILD_GIT_INFO
    : JSON.parse(process.env.BUILD_GIT_INFO || '{}');
export const BUILD_GIT_INFO: {
  BUILD_GIT_HASH: string;
  BUILD_GIT_HASH_TIME?: string;
  BUILD_GIT_COMMITOR?: string;
} = {
  BUILD_GIT_HASH: 'unknown',
  BUILD_GIT_HASH_TIME: undefined,
  BUILD_GIT_COMMITOR: undefined,
  ...INPUT_BUILD_GIT_INFO,
};

export function getSentryEnv() {
  return `ch:${BUILD_CHANNEL}|env:${APP_RUNTIME_ENV}`;
}

export const SENTRY_DEBUG = APP_RUNTIME_ENV !== 'production';

export const IS_HERMES_ENABLED = !!(global as any).HermesInternal;

export const appIsProd = process.env.NODE_ENV === 'production';
export const appIsDev = __DEV__;

export const SAFE_API_KEY =
  /* from .env* */ RABBY_MOBILE_SAFE_API_KEY_ ||
  /* for developer */ process.env.RABBY_MOBILE_SAFE_API_KEY ||
  process.env.MOBILE_SAFE_API_KEY ||
  '';
