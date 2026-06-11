import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { APP_VERSIONS } from '@/constant';
import { SENTRY_DEBUG, getSentryEnv } from '@/constant/env';
import { getUserBehaviorTrackingOptOut } from '@/utils/trackingOptOut';

let sentryInitialized = false;
let sentryClosing: Promise<void> | undefined;

type MutableSentryRuntimeOptions = {
  enabled?: boolean;
  enableAutoSessionTracking?: boolean;
};

function shouldSendToSentry() {
  return !getUserBehaviorTrackingOptOut();
}

function dropWhenTrackingOptedOut<T>(event: T) {
  return shouldSendToSentry() ? event : null;
}

function canInitializeSentry() {
  return !__DEV__;
}

export function syncSentryUserBehaviorTrackingEnabled() {
  const enabled = shouldSendToSentry();
  const client = Sentry.getClient();
  const options = client?.getOptions() as
    | MutableSentryRuntimeOptions
    | undefined;

  if (options) {
    options.enabled = enabled;
    options.enableAutoSessionTracking = enabled;
  }

  if (enabled) {
    if (!sentryInitialized && canInitializeSentry()) {
      if (sentryClosing) {
        void sentryClosing.finally(() => {
          if (shouldSendToSentry()) {
            initSentry();
          }
        });
      } else {
        initSentry();
      }
    }
    return;
  }

  sentryInitialized = false;
  if (client) {
    const closeSentry = (
      Sentry as typeof Sentry & { close?: () => Promise<void> }
    ).close;
    sentryClosing = closeSentry?.().finally(() => {
      sentryClosing = undefined;
    });
  }
}

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
  if (!canInitializeSentry()) {
    return;
  }

  if (!shouldSendToSentry()) {
    syncSentryUserBehaviorTrackingEnabled();
    return;
  }

  if (sentryInitialized) {
    syncSentryUserBehaviorTrackingEnabled();
    return;
  }

  Sentry.init({
    enabled: true,
    dsn: 'https://86c83b97aaf2afd16f3d3227340c78dd@o4507018303438848.ingest.us.sentry.io/4507018395975680',
    release: APP_VERSIONS.forSentry,
    ignoreErrors: [
      'Missing or invalid topic field',
      'Non-Error exception captured',
      'WebSocket connection failed for URL: wss://relay.walletconnect.com',
      "TurboModules are enabled, but mTurboModuleRegistry hasn't been set",
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
    enableAutoSessionTracking: true,
    environment: getSentryEnv(),
    debug: SENTRY_DEBUG,
    beforeBreadcrumb: breadcrumb => dropWhenTrackingOptedOut(breadcrumb),
    beforeSend: event => dropWhenTrackingOptedOut(event),
    beforeSendTransaction: event => dropWhenTrackingOptedOut(event),
    _experiments: {
      // The sampling rate for profiling is relative to TracesSampleRate.
      // In this case, we'll capture profiles for 100% of transactions.
      profilesSampleRate: 1.0,
    },
  });
  sentryInitialized = true;
}
