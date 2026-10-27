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

  return shouldDropSentryEvent(event, hint) ? null : scrubSentryPayload(event);
}

function beforeSendSentryBreadcrumb(breadcrumb: SentryBreadcrumb) {
  const kept = dropWhenTrackingOptedOut(breadcrumb);
  return kept ? scrubSentryPayload(kept) : null;
}

function beforeSendSentryTransaction(event: SentryTransactionEvent) {
  const kept = dropWhenTrackingOptedOut(event);
  return kept ? scrubSentryPayload(kept) : null;
}

const EVM_ADDRESS_PATTERN = /\b0x[0-9a-fA-F]{40}\b/g;
export const SENTRY_REDACTED_ADDRESS = '0x[redacted]';
export const SENTRY_REDACTED = '[redacted]';
// A private key has the same shape as a tx/block hash, so every 32-byte hex
// value is dropped.
const HEX_32_BYTES_PATTERN = /\b(?:0x)?[0-9a-fA-F]{64}\b/g;
const SENSITIVE_KEY_PATTERN =
  /mnemonic|seed|phrase|private_?key|secret|password|passphrase|vault|keystore|ciphertext|entropy/i;
const MNEMONIC_MIN_WORDS = 12;
// 12+ words separated only by whitespace, commas, quotes or brackets, as in a
// typed phrase, `String(words)` or `JSON.stringify(words)`.
const WORD_RUN_PATTERN = /[a-z]+(?:[\s,"'[\]]+[a-z]+){11,}/gi;
// Rabby API GETs carry addresses in query params (`?id=0x…`, `?user_addr=…`).
const URL_QUERY_IN_TEXT_PATTERN =
  /\b((?:https?|wss?):\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi;
const URL_VALUE_KEYS = new Set(['url', 'http.url', 'url.full', 'from', 'to']);
const URL_QUERY_KEYS = new Set([
  'http.query',
  'http.fragment',
  'url.query',
  'url.fragment',
]);
const MAX_SCRUB_DEPTH = 12;

let bip39Words: Set<string> | undefined;

function isBip39Word(word: string) {
  if (!bip39Words) {
    // Loaded on first scrub: index.js imports this module eagerly, and the
    // wordlist is not needed until something is about to be sent.
    const { wordlist } =
      require('@scure/bip39/wordlists/english') as typeof import('@scure/bip39/wordlists/english');
    bip39Words = new Set(wordlist);
  }
  return bip39Words.has(word.toLowerCase());
}

function redactMnemonicRuns(text: string) {
  return text.replace(WORD_RUN_PATTERN, run => {
    const spans: Array<[number, number]> = [];
    let runStart = 0;
    let runEnd = 0;
    let count = 0;
    const closeRun = () => {
      if (count >= MNEMONIC_MIN_WORDS) {
        spans.push([runStart, runEnd]);
      }
      count = 0;
    };

    const wordPattern = /[a-z]+/gi;
    for (
      let match = wordPattern.exec(run);
      match;
      match = wordPattern.exec(run)
    ) {
      if (!isBip39Word(match[0])) {
        closeRun();
        continue;
      }
      if (count === 0) {
        runStart = match.index;
      }
      count += 1;
      runEnd = match.index + match[0].length;
    }
    closeRun();

    if (!spans.length) {
      return run;
    }
    let output = '';
    let cursor = 0;
    for (const [start, end] of spans) {
      output += run.slice(cursor, start) + SENTRY_REDACTED;
      cursor = end;
    }
    return output + run.slice(cursor);
  });
}

function isMnemonicWordList(values: unknown[]) {
  let count = 0;
  for (const item of values) {
    if (typeof item === 'string' && isBip39Word(item.trim())) {
      count += 1;
    }
  }
  return count >= MNEMONIC_MIN_WORDS;
}

function isSensitiveEntry(key: string, value: unknown) {
  return (
    SENSITIVE_KEY_PATTERN.test(key) &&
    value !== null &&
    value !== undefined &&
    typeof value !== 'boolean' &&
    typeof value !== 'number'
  );
}

function scrubSentryText(text: string) {
  return redactMnemonicRuns(
    text
      .replace(URL_QUERY_IN_TEXT_PATTERN, '$1')
      .replace(HEX_32_BYTES_PATTERN, SENTRY_REDACTED)
      .replace(EVM_ADDRESS_PATTERN, SENTRY_REDACTED_ADDRESS),
  );
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Copy-on-write: breadcrumb data and `extra` can hold live app objects
 * (console arguments, store state), so nothing is mutated in place and an
 * unchanged value keeps its identity.
 */
function scrubSentryValue(
  value: unknown,
  depth: number,
  ancestors: Set<object>,
  key?: string,
): unknown {
  if (typeof value === 'string') {
    const text =
      key && URL_VALUE_KEYS.has(key)
        ? value.replace(/[?#][\s\S]*$/, '')
        : value;
    return scrubSentryText(text);
  }

  if (
    !value ||
    typeof value !== 'object' ||
    depth > MAX_SCRUB_DEPTH ||
    ancestors.has(value)
  ) {
    return value;
  }

  if (value instanceof Error) {
    const plain = {
      ...value,
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    const scrubbed = scrubSentryValue(plain, depth, ancestors, key);
    return scrubbed === plain ? value : scrubbed;
  }

  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value;
  }

  if (Array.isArray(value) && isMnemonicWordList(value)) {
    return SENTRY_REDACTED;
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map(item => {
        const scrubbed = scrubSentryValue(item, depth + 1, ancestors);
        changed ||= scrubbed !== item;
        return scrubbed;
      });
      return changed ? next : value;
    }

    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (URL_QUERY_KEYS.has(entryKey)) {
        changed = true;
        continue;
      }

      const scrubbedKey = scrubSentryText(entryKey);
      const scrubbedValue = isSensitiveEntry(entryKey, entryValue)
        ? SENTRY_REDACTED
        : scrubSentryValue(entryValue, depth + 1, ancestors, entryKey);
      changed ||= scrubbedKey !== entryKey || scrubbedValue !== entryValue;

      let outputKey = scrubbedKey;
      for (
        let suffix = 2;
        Object.prototype.hasOwnProperty.call(next, outputKey);
        suffix++
      ) {
        outputKey = `${scrubbedKey}#${suffix}`;
      }
      next[outputKey] = scrubbedValue;
    }
    return changed ? next : value;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Strips URL query strings and redacts EVM addresses, 32-byte hex values
 * (private keys), BIP39 mnemonics and values under secret-looking keys from
 * anything that is about to leave the device (events, transactions,
 * breadcrumbs).
 */
export function scrubSentryPayload<T>(payload: T): T {
  return scrubSentryValue(payload, 0, new Set()) as T;
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
type SentryBreadcrumb = Parameters<
  NonNullable<ReactNativeOptions['beforeBreadcrumb']>
>[0];
type SentryTransactionEvent = Parameters<
  NonNullable<ReactNativeOptions['beforeSendTransaction']>
>[0];

// Read by sentry-cocoa from the native options dict; not in the RN typings.
// JS already records every request as an XHR breadcrumb (scrubbed below), but
// native crash reports never pass through the JS hooks, so the duplicate
// NSURLSession breadcrumbs (with `http.query`) are turned off.
const NATIVE_ONLY_SENTRY_OPTIONS = {
  enableNetworkBreadcrumbs: false,
};

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
    // Console output can carry anything (a logged seed phrase, keyring state)
    // and builds that keep `console` still report here, so it never becomes
    // breadcrumbs. Overrides the default Breadcrumbs integration by name.
    integrations: [Sentry.breadcrumbsIntegration({ console: false })],
    beforeBreadcrumb: beforeSendSentryBreadcrumb,
    beforeSend: beforeSendSentryEvent,
    beforeSendTransaction: beforeSendSentryTransaction,
    _experiments: {
      // The sampling rate for profiling is relative to TracesSampleRate.
      // In this case, we'll capture profiles for 100% of transactions.
      profilesSampleRate: 1.0,
    },
    ...NATIVE_ONLY_SENTRY_OPTIONS,
  });
  sentryInitialized = true;
}
