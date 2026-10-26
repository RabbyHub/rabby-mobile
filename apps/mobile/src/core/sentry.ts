import * as Sentry from '@sentry/react-native';
import type { ReactNativeOptions } from '@sentry/react-native';

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

function beforeSendSentryEvent(event: SentryEvent, hint?: SentryEventHint) {
  if (!shouldSendToSentry()) {
    return null;
  }

  return shouldDropSentryEvent(event, hint) ? null : event;
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

type SentryBeforeSend = NonNullable<ReactNativeOptions['beforeSend']>;
type SentryEvent = Parameters<SentryBeforeSend>[0];
type SentryEventHint = Parameters<SentryBeforeSend>[1];

export const SENTRY_IGNORED_ERROR_MESSAGES = [
  'Missing or invalid topic field',
  'Non-Error exception captured',
] as const;

export const SENTRY_IGNORED_ERROR_PATTERNS = [
  /\b(?:network(?:\s+request)?\s+(?:failed|error|timed out)|request\s+(?:failed|timeout|timed out)|timeout exceeded)\b/i,
  /\bdevice (?:is inactive|not found)\b/i,
  /\bfailed to connect\b/i,
  /\bwebsocket\b.*\bfailed\b/i,
  /\bempty push token\b/i,
  /\balready added this chain\b/i,
  /\bbilling is unavailable\b/i,
  /\bstop loss cancel\b/i,
  /\b(?:https?:\/\/|http(?:\b|-))/i,
] as const;

const SENTRY_IGNORED_ERROR_KEY_SETS = [
  ['_bubbles', '_cancelable', '_composed'],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function normalizeSentryText(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return [String(value)];
  }

  if (value instanceof Error) {
    return [value.name, value.message].filter((text): text is string => !!text);
  }

  if (!isRecord(value)) {
    return [];
  }

  const keys = Object.keys(value);
  const knownFields = [
    value.name,
    value.message,
    value.type,
    value.value,
    value.reason,
  ];

  return [
    ...keys,
    keys.join(', '),
    ...knownFields.flatMap(normalizeSentryText),
  ].filter(Boolean);
}

function getSentryEventTextFragments(
  event: SentryEvent,
  hint?: SentryEventHint,
) {
  const fragments: unknown[] = [
    event.message,
    event.logentry?.message,
    event.transaction,
    hint?.originalException,
    hint?.syntheticException,
    hint?.data,
  ];

  event.exception?.values?.forEach(exception => {
    fragments.push(exception.type, exception.value);

    exception.stacktrace?.frames?.forEach(frame => {
      fragments.push(frame.filename, frame.abs_path, frame.function);
    });
  });

  return fragments.flatMap(normalizeSentryText);
}

function hasIgnoredSentryPattern(fragment: string) {
  return SENTRY_IGNORED_ERROR_MESSAGES.some(message =>
    fragment.toLowerCase().includes(message.toLowerCase()),
  )
    ? true
    : SENTRY_IGNORED_ERROR_PATTERNS.some(pattern => pattern.test(fragment));
}

export function shouldDropSentryEvent(
  event: SentryEvent,
  hint?: SentryEventHint,
) {
  const fragments = getSentryEventTextFragments(event, hint);
  const hasIgnoredMessage = fragments.some(hasIgnoredSentryPattern);

  if (hasIgnoredMessage) {
    return true;
  }

  const normalizedFragments = fragments.map(text => text.toLowerCase());

  return SENTRY_IGNORED_ERROR_KEY_SETS.some(keySet =>
    keySet.every(key =>
      normalizedFragments.some(fragment => fragment.includes(key)),
    ),
  );
}

export function initSentry() {
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
      ...SENTRY_IGNORED_ERROR_MESSAGES,
      ...SENTRY_IGNORED_ERROR_PATTERNS,
    ],
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production.
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    environment: getSentryEnv(),
    debug: SENTRY_DEBUG,
    beforeBreadcrumb: breadcrumb => dropWhenTrackingOptedOut(breadcrumb),
    beforeSend: beforeSendSentryEvent,
    beforeSendTransaction: event => dropWhenTrackingOptedOut(event),
    _experiments: {
      // The sampling rate for profiling is relative to TracesSampleRate.
      // In this case, we'll capture profiles for 100% of transactions.
      profilesSampleRate: 1.0,
    },
  });
  sentryInitialized = true;
}
