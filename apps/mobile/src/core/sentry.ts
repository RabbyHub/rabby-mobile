import * as Sentry from '@sentry/react-native';
import type { ReactNativeOptions } from '@sentry/react-native';

import { APP_VERSIONS } from '@/constant';
import { SENTRY_DEBUG, getSentryEnv } from '@/constant/env';

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
  Sentry.init({
    dsn: 'https://86c83b97aaf2afd16f3d3227340c78dd@o4507018303438848.ingest.us.sentry.io/4507018395975680',
    release: APP_VERSIONS.forSentry,
    ignoreErrors: [
      ...SENTRY_IGNORED_ERROR_MESSAGES,
      ...SENTRY_IGNORED_ERROR_PATTERNS,
    ],
    beforeSend(event, hint) {
      return shouldDropSentryEvent(event, hint) ? null : event;
    },
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
