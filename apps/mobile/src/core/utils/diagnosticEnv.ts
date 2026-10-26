import { APP_RUNTIME_ENV, BUILD_CHANNEL } from '@/constant/env';

export const isNonProductionDiagnosticsEnabled =
  __DEV__ ||
  APP_RUNTIME_ENV !== 'production' ||
  BUILD_CHANNEL === 'selfhost-reg';
