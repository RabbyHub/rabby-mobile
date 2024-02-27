import { DEV_CONSOLE_URL as DEV_CONSOLE_URL_ } from '@env';

export type AppBuildChannel = 'selfhost' | 'selfhost-reg' | 'appstore';
export const BUILD_CHANNEL =
  (process.env.buildchannel as AppBuildChannel) || 'selfhost-reg';
export const DEV_CONSOLE_URL = DEV_CONSOLE_URL_;
