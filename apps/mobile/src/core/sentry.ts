import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { APP_VERSIONS } from '@/constant';
import { SENTRY_DEBUG, getSentryEnv } from '@/constant/env';

const isAndroidBridgelessRuntime = () => {
  if (Platform.OS !== 'android') {
    return false;
  }

  const rnRuntime = globalThis as typeof globalThis & {
    RN$Bridgeless?: boolean;
    __turboModuleProxy?: unknown;
  };

  return rnRuntime.RN$Bridgeless === true || !!rnRuntime.__turboModuleProxy;
};

export function initSentry() {
  const disableNativeBridgeAccess = isAndroidBridgelessRuntime();

  Sentry.init({
    dsn: 'https://86c83b97aaf2afd16f3d3227340c78dd@o4507018303438848.ingest.us.sentry.io/4507018395975680',
    release: APP_VERSIONS.forSentry,
    ignoreErrors: [
      'Missing or invalid topic field',
      'Non-Error exception captured',
      'WebSocket connection failed for URL: wss://relay.walletconnect.com',
      'TurboModules are enabled, but mTurboModuleRegistry hasn\'t been set',
      'TurboModules are enabled, but mTurboModuleRegistry has not been set',
    ],
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production.
    tracesSampleRate: 0.2,
    enableNative: !disableNativeBridgeAccess,
    enableNativeCrashHandling: !disableNativeBridgeAccess,
    enableNativeNagger: !disableNativeBridgeAccess,
    enableNdk: !disableNativeBridgeAccess,
    enableAutoPerformanceTracing: !disableNativeBridgeAccess,
    enableAppStartTracking: !disableNativeBridgeAccess,
    enableNativeFramesTracking: !disableNativeBridgeAccess,
    enableStallTracking: !disableNativeBridgeAccess,
    environment: getSentryEnv(),
    debug: SENTRY_DEBUG,
    _experiments: {
      // The sampling rate for profiling is relative to TracesSampleRate.
      // In this case, we'll capture profiles for 100% of transactions.
      profilesSampleRate: 1.0,
    },
  });
}
