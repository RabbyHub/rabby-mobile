import * as Sentry from '@sentry/react-native';

import { APP_VERSIONS } from '@/constant';
import { SENTRY_DEBUG, getSentryEnv } from '@/constant/env';

export function initSentry() {
  Sentry.init({
    dsn: 'https://5dc34e0794776dfb2d4e263b466b5052@o460488.ingest.sentry.io/4506406044696576',
    release: APP_VERSIONS.forSentry,
    ignoreErrors: [
      'Missing or invalid topic field',
      'Non-Error exception captured',
      'WebSocket connection failed for URL: wss://relay.walletconnect.com',
    ],
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production.
    tracesSampleRate: 0.2,
    environment: getSentryEnv(),
    debug: SENTRY_DEBUG,
    _experiments: {
      // The sampling rate for profiling is relative to TracesSampleRate.
      // In this case, we'll capture profiles for 100% of transactions.
      profilesSampleRate: 1.0,
    },
  });
}
