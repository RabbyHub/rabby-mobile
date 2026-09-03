import { NativeModules, Platform } from 'react-native';

import { isNonProductionDiagnosticsEnabled } from './diagnosticEnv';

type TraceArgs = Record<string, unknown>;
type NativeTraceArgs = Record<string, string>;
type NativeTraceGlobal = typeof globalThis & {
  nativeTraceBeginSection?: (
    tag: number,
    name: string,
    args?: NativeTraceArgs,
  ) => void;
  nativeTraceEndSection?: (tag: number, args?: NativeTraceArgs) => void;
  nativeTraceBeginAsyncSection?: (
    tag: number,
    name: string,
    cookie: number,
    args?: NativeTraceArgs,
  ) => void;
  nativeTraceEndAsyncSection?: (
    tag: number,
    name: string,
    cookie: number,
    args?: NativeTraceArgs,
  ) => void;
  nativeTraceCounter?: (tag: number, name: string, value: number) => void;
};
type NativeModuleTrace = {
  androidTraceInstant?: (name: string) => void;
  androidTraceBeginAsyncSection?: (name: string, cookie: number) => void;
  androidTraceEndAsyncSection?: (name: string, cookie: number) => void;
  androidTraceCounter?: (name: string, value: number) => void;
};

const TRACE_TAG_REACT = 1 << 13;
const TRACE_NAME_PREFIX = 'Rabby:';
const MAX_TRACE_NAME_LENGTH = 110;
const MAX_TRACE_ARG_LENGTH = 48;

const enabled = Platform.OS === 'android' && isNonProductionDiagnosticsEnabled;

let nextCookieValue = 100000;
let loggedMissingNativeTrace = false;
let loggedFallbackNativeTrace = false;

function getNativeTraceGlobal() {
  return globalThis as NativeTraceGlobal;
}

function getNativeModuleTrace() {
  try {
    const nativeRNHelpers = require('@/core/native/specs/NativeRNHelpers')
      .default as NativeModuleTrace | undefined;
    if (nativeRNHelpers) {
      return nativeRNHelpers;
    }
  } catch {
    // Some Jest mocks do not provide TurboModuleRegistry. Fall back below.
  }

  return NativeModules.RNHelpers as NativeModuleTrace | undefined;
}

function normalizeTraceName(name: string) {
  const normalized = `${name || 'unknown'}`
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const prefixed = normalized.startsWith(TRACE_NAME_PREFIX)
    ? normalized
    : `${TRACE_NAME_PREFIX}${normalized}`;

  return prefixed.length > MAX_TRACE_NAME_LENGTH
    ? prefixed.slice(0, MAX_TRACE_NAME_LENGTH)
    : prefixed;
}

function normalizeTraceArgs(args?: TraceArgs): NativeTraceArgs | undefined {
  if (!args) {
    return undefined;
  }

  const normalized: NativeTraceArgs = {};
  Object.entries(args).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const stringValue = String(value);
    normalized[key] =
      stringValue.length > MAX_TRACE_ARG_LENGTH
        ? stringValue.slice(0, MAX_TRACE_ARG_LENGTH)
        : stringValue;
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function appendArgsToTraceName(name: string, args?: NativeTraceArgs): string {
  if (!args) {
    return name;
  }

  const argsText = Object.entries(args)
    .map(([key, value]) => `${key}=${value}`)
    .join(';');
  const nextName = `${name}|${argsText}`;

  return nextName.length > MAX_TRACE_NAME_LENGTH
    ? nextName.slice(0, MAX_TRACE_NAME_LENGTH)
    : nextName;
}

function hasDirectSyncTrace(traceGlobal = getNativeTraceGlobal()) {
  return (
    typeof traceGlobal.nativeTraceBeginSection === 'function' &&
    typeof traceGlobal.nativeTraceEndSection === 'function'
  );
}

function hasDirectAsyncTrace(traceGlobal = getNativeTraceGlobal()) {
  return (
    typeof traceGlobal.nativeTraceBeginAsyncSection === 'function' &&
    typeof traceGlobal.nativeTraceEndAsyncSection === 'function'
  );
}

function hasDirectCounterTrace(traceGlobal = getNativeTraceGlobal()) {
  return typeof traceGlobal.nativeTraceCounter === 'function';
}

function logFallbackNativeTraceOnce() {
  if (loggedFallbackNativeTrace) {
    return;
  }

  loggedFallbackNativeTrace = true;
  console.info(
    '[RabbyAndroidTrace] native trace globals are unavailable; using RNHelpers fallback',
  );
}

function logMissingNativeTraceOnce() {
  if (loggedMissingNativeTrace) {
    return;
  }

  loggedMissingNativeTrace = true;
  console.info(
    '[RabbyAndroidTrace] native trace globals and RNHelpers fallback are unavailable',
  );
}

export function isAndroidTraceEnabled() {
  return enabled;
}

export function nextAndroidTraceCookie() {
  nextCookieValue += 1;
  return nextCookieValue;
}

export function traceAndroidInstant(name: string, args?: TraceArgs) {
  if (!enabled) {
    return;
  }

  const traceGlobal = getNativeTraceGlobal();
  const normalizedName = normalizeTraceName(name);
  const normalizedArgs = normalizeTraceArgs(args);
  if (hasDirectSyncTrace(traceGlobal)) {
    traceGlobal.nativeTraceBeginSection?.(
      TRACE_TAG_REACT,
      normalizedName,
      normalizedArgs,
    );
    traceGlobal.nativeTraceEndSection?.(TRACE_TAG_REACT);
    return;
  }

  const nativeModuleTrace = getNativeModuleTrace();
  if (typeof nativeModuleTrace?.androidTraceInstant === 'function') {
    logFallbackNativeTraceOnce();
    nativeModuleTrace.androidTraceInstant(
      appendArgsToTraceName(normalizedName, normalizedArgs),
    );
    return;
  }

  logMissingNativeTraceOnce();
}

export function beginAndroidTraceSection(name: string, args?: TraceArgs) {
  if (!enabled) {
    return false;
  }

  const traceGlobal = getNativeTraceGlobal();
  if (!hasDirectSyncTrace(traceGlobal)) {
    return false;
  }

  traceGlobal.nativeTraceBeginSection?.(
    TRACE_TAG_REACT,
    normalizeTraceName(name),
    normalizeTraceArgs(args),
  );
  return true;
}

export function endAndroidTraceSection(args?: TraceArgs) {
  if (!enabled) {
    return;
  }

  const traceGlobal = getNativeTraceGlobal();
  if (!hasDirectSyncTrace(traceGlobal)) {
    return;
  }

  traceGlobal.nativeTraceEndSection?.(
    TRACE_TAG_REACT,
    normalizeTraceArgs(args),
  );
}

export function beginAndroidAsyncTrace(
  name: string,
  cookie: number,
  args?: TraceArgs,
) {
  if (!enabled) {
    return false;
  }

  const traceGlobal = getNativeTraceGlobal();
  const normalizedName = normalizeTraceName(name);
  const normalizedArgs = normalizeTraceArgs(args);
  if (hasDirectAsyncTrace(traceGlobal)) {
    traceGlobal.nativeTraceBeginAsyncSection?.(
      TRACE_TAG_REACT,
      normalizedName,
      cookie,
      normalizedArgs,
    );
    return true;
  }

  const nativeModuleTrace = getNativeModuleTrace();
  if (typeof nativeModuleTrace?.androidTraceBeginAsyncSection === 'function') {
    logFallbackNativeTraceOnce();
    nativeModuleTrace.androidTraceBeginAsyncSection(
      appendArgsToTraceName(normalizedName, normalizedArgs),
      cookie,
    );
    return true;
  }

  logMissingNativeTraceOnce();
  return false;
}

export function endAndroidAsyncTrace(
  name: string,
  cookie: number,
  args?: TraceArgs,
) {
  if (!enabled) {
    return;
  }

  const traceGlobal = getNativeTraceGlobal();
  const normalizedName = normalizeTraceName(name);
  const normalizedArgs = normalizeTraceArgs(args);
  if (hasDirectAsyncTrace(traceGlobal)) {
    traceGlobal.nativeTraceEndAsyncSection?.(
      TRACE_TAG_REACT,
      normalizedName,
      cookie,
      normalizedArgs,
    );
    return;
  }

  const nativeModuleTrace = getNativeModuleTrace();
  if (typeof nativeModuleTrace?.androidTraceEndAsyncSection === 'function') {
    nativeModuleTrace.androidTraceEndAsyncSection(
      appendArgsToTraceName(normalizedName, normalizedArgs),
      cookie,
    );
  }
}

export function traceAndroidCounter(name: string, value: number) {
  if (!enabled) {
    return;
  }

  const traceGlobal = getNativeTraceGlobal();
  const normalizedName = normalizeTraceName(name);
  if (hasDirectCounterTrace(traceGlobal)) {
    traceGlobal.nativeTraceCounter?.(TRACE_TAG_REACT, normalizedName, value);
    return;
  }

  const nativeModuleTrace = getNativeModuleTrace();
  if (typeof nativeModuleTrace?.androidTraceCounter === 'function') {
    logFallbackNativeTraceOnce();
    nativeModuleTrace.androidTraceCounter(normalizedName, value);
  }
}
