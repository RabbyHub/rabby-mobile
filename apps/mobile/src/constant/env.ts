import { DEV_CONSOLE_URL as DEV_CONSOLE_URL_ } from '@env';

export const BUILD_CHANNEL = process.env.buildchannel as
  | 'selfhost'
  | 'selfhost-reg'
  | 'appstore';
export const DEV_CONSOLE_URL = DEV_CONSOLE_URL_;
