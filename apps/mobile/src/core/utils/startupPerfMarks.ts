type StartupPerfData = Record<string, unknown>;
type NativeTraceGlobal = typeof globalThis & {
  nativeTraceBeginSection?: (
    tag: number,
    name: string,
    args?: Record<string, string>,
  ) => void;
  nativeTraceEndSection?: (tag: number) => void;
};

const TRACE_TAG_REACT = 1 << 13;
const TRACE_NAME_PREFIX = 'Rabby:';
const MAX_TRACE_NAME_LENGTH = 110;
const MAX_TRACE_ARG_LENGTH = 48;

const enabled =
  __DEV__ ||
  process.env.RABBY_MOBILE_BUILD_ENV !== 'production' ||
  process.env.buildchannel === 'selfhost-reg';

function normalizeTraceName(scope: string, event: string) {
  const normalized = `${TRACE_NAME_PREFIX}startup.${scope}.${event}`
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length > MAX_TRACE_NAME_LENGTH
    ? normalized.slice(0, MAX_TRACE_NAME_LENGTH)
    : normalized;
}

function normalizeTraceArgs(data?: StartupPerfData) {
  if (!data) {
    return undefined;
  }

  const normalized: Record<string, string> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const stringValue = String(value);
    normalized[key] =
      stringValue.length > MAX_TRACE_ARG_LENGTH
        ? stringValue.slice(0, MAX_TRACE_ARG_LENGTH)
        : stringValue;
  });

  return Object.keys(normalized).length ? normalized : undefined;
}

function traceInstant(scope: string, event: string, data?: StartupPerfData) {
  const traceGlobal = globalThis as NativeTraceGlobal;
  if (
    typeof traceGlobal.nativeTraceBeginSection !== 'function' ||
    typeof traceGlobal.nativeTraceEndSection !== 'function'
  ) {
    return;
  }

  traceGlobal.nativeTraceBeginSection(
    TRACE_TAG_REACT,
    normalizeTraceName(scope, event),
    normalizeTraceArgs(data),
  );
  traceGlobal.nativeTraceEndSection(TRACE_TAG_REACT);
}

export function markStartupPerf(
  scope: string,
  event: string,
  data: StartupPerfData = {},
) {
  if (!enabled) {
    return;
  }

  traceInstant(scope, event, data);
  console.info(`[RabbyStartupPerf:${scope}] ${event}`, data);
}
