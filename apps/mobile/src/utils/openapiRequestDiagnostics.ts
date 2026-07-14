import type { OpenApiService } from '@rabby-wallet/rabby-api';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';
import { shouldSuppressPerfCaptureConsoleNoise } from '@/core/utils/perfCaptureConsole';
import { logger } from './logger';
import {
  openApiDebugEvents,
  OPENAPI_HTTP_ERROR_DEBUG,
} from './openapiDebugEvents';

const REQUEST_LOG_META_KEY = '__rabbyOpenApiRequestDiagnosticMeta';
const REQUEST_INSTRUMENTED_KEY = Symbol(
  'rabbyOpenApiRequestDiagnostics/request',
);
const SERVICE_INSTRUMENTED_KEY = Symbol(
  'rabbyOpenApiRequestDiagnostics/service',
);
const RESPONSE_WRAPPED_KEY = Symbol('rabbyOpenApiRequestDiagnostics/response');
const OPENAPI_SLOW_REQUEST_MS = 1500;
const OPENAPI_DIAGNOSTIC_RECORD_LIMIT = 50;

const SENSITIVE_KEYWORDS = [
  'api-key',
  'api-sign',
  'authorization',
  'cookie',
  'mnemonic',
  'nonce',
  'password',
  'private',
  'secret',
  'seed',
  'session',
  'signature',
  'token',
] as const;

type OpenApiFailureSource = 'openapi' | 'testOpenapi' | 'notificationOpenapi';
export type OpenApiRequestDiagnosticSource = OpenApiFailureSource;
export type OpenApiRequestDiagnosticOutcome =
  | 'success'
  | 'slow'
  | 'http_error'
  | 'api_error'
  | 'timeout'
  | 'network_error'
  | 'error';

export type OpenApiRequestDiagnosticRecord = {
  id: number;
  source: OpenApiRequestDiagnosticSource;
  requestId: string;
  method: string;
  baseURL: string;
  url: string;
  path: string;
  params: unknown;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  status?: number;
  apiCode?: number | string | null;
  outcome: OpenApiRequestDiagnosticOutcome;
  isSlow: boolean;
  errorCode?: string;
  errorMessage?: string;
};

export type OpenApiRequestDiagnosticsSnapshot = {
  enabled: boolean;
  updatedAt: number;
  slowThresholdMs: number;
  inFlightCount: number;
  records: OpenApiRequestDiagnosticRecord[];
  slowCount: number;
  errorCount: number;
  lastRecord: OpenApiRequestDiagnosticRecord | null;
};

type InstrumentedRequestConfig = AxiosRequestConfig & {
  [REQUEST_LOG_META_KEY]?: {
    source: OpenApiFailureSource;
    requestId: string;
    startedAt: number;
    finalized?: boolean;
  };
};

type AxiosRequestLike = OpenApiService['request'] & {
  [REQUEST_INSTRUMENTED_KEY]?: boolean;
  interceptors: OpenApiService['request']['interceptors'] & {
    response: OpenApiService['request']['interceptors']['response'] & {
      handlers?: Array<{
        fulfilled?: (
          value: AxiosResponse,
        ) => AxiosResponse | Promise<AxiosResponse>;
        rejected?: (error: unknown) => unknown;
      } | null>;
    };
  };
};

type OpenApiDiagnosticsGlobal = typeof globalThis & {
  __RABBY_OPENAPI_DIAGNOSTIC_CONSOLE_DISABLED__?: boolean;
};

const diagnosticsEnabled = isNonProductionDiagnosticsEnabled;
let nextOpenApiDiagnosticId = 0;
let lastOpenApiDiagnosticsUpdatedAt = Date.now();
const openApiDiagnosticRecords: OpenApiRequestDiagnosticRecord[] = [];
const openApiInFlightRequests = new Map<string, true>();
const openApiDiagnosticListeners = new Set<() => void>();

function notifyOpenApiDiagnosticListeners() {
  openApiDiagnosticListeners.forEach(listener => {
    listener();
  });
}

function getErrorRecordCount() {
  return openApiDiagnosticRecords.filter(
    record => record.outcome.endsWith('_error') || record.outcome === 'timeout',
  ).length;
}

export function getOpenApiRequestDiagnosticsSnapshot(): OpenApiRequestDiagnosticsSnapshot {
  const records = openApiDiagnosticRecords.slice();

  return {
    enabled: diagnosticsEnabled,
    updatedAt: lastOpenApiDiagnosticsUpdatedAt,
    slowThresholdMs: OPENAPI_SLOW_REQUEST_MS,
    inFlightCount: openApiInFlightRequests.size,
    records,
    slowCount: records.filter(record => record.isSlow).length,
    errorCount: getErrorRecordCount(),
    lastRecord: records[0] || null,
  };
}

export function subscribeOpenApiRequestDiagnosticsSnapshot(
  listener: () => void,
) {
  openApiDiagnosticListeners.add(listener);

  return () => {
    openApiDiagnosticListeners.delete(listener);
  };
}

function toHeaderObject(
  headers: AxiosRequestConfig['headers'] | AxiosResponse['headers'],
) {
  if (!headers) {
    return {};
  }

  const maybeHeaders = headers as {
    toJSON?: () => Record<string, unknown>;
  };

  if (typeof maybeHeaders.toJSON === 'function') {
    return maybeHeaders.toJSON();
  }

  if (typeof headers === 'object') {
    return { ...(headers as Record<string, unknown>) };
  }

  return {};
}

function makeRequestId(source: OpenApiFailureSource) {
  return `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncateString(value: string, max = 1200) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 3)}...`;
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYWORDS.some(keyword => normalized.includes(keyword));
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function sanitizeValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (typeof value === 'undefined') {
    return '[undefined]';
  }

  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message),
      ...(value.stack ? { stack: truncateString(value.stack, 2400) } : {}),
    };
  }

  if (Array.isArray(value)) {
    if (depth >= 4) {
      return `[Array(${value.length})]`;
    }

    const nextValues = value
      .slice(0, 20)
      .map(item => sanitizeValue(item, depth + 1, seen));

    if (value.length > 20) {
      nextValues.push(`[Truncated ${value.length - 20} items]`);
    }

    return nextValues;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (depth >= 4) {
      return `[${value.constructor?.name || 'Object'}]`;
    }

    const output: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);

    entries.slice(0, 40).forEach(([key, item]) => {
      output[key] = isSensitiveKey(key)
        ? logger.mask(String(item ?? ''))
        : sanitizeValue(item, depth + 1, seen);
    });

    if (entries.length > 40) {
      output.__truncated_keys__ = entries.length - 40;
    }

    return output;
  }

  return String(value);
}

function sanitizeHeaders(
  headers: AxiosRequestConfig['headers'] | AxiosResponse['headers'],
) {
  const headerObject = toHeaderObject(headers);

  return Object.fromEntries(
    Object.entries(headerObject).map(([key, value]) => [
      key,
      isSensitiveKey(key)
        ? logger.mask(String(value ?? ''))
        : sanitizeValue(value),
    ]),
  );
}

function buildRequestUrl(config: AxiosRequestConfig) {
  if (!config.url) {
    return config.baseURL || '[missing-url]';
  }

  if (/^https?:\/\//i.test(config.url)) {
    return config.url;
  }

  if (!config.baseURL) {
    return config.url;
  }

  try {
    return new URL(config.url, config.baseURL).toString();
  } catch (_error) {
    const left = config.baseURL.replace(/\/+$/, '');
    const right = config.url.replace(/^\/+/, '');
    return `${left}/${right}`;
  }
}

function buildRequestPath(config?: AxiosRequestConfig) {
  if (!config) {
    return '[missing-url]';
  }

  const fullUrl = buildRequestUrl(config);

  try {
    const url = new URL(fullUrl);
    return truncateString(`${url.pathname}${url.search}` || url.pathname, 240);
  } catch (_error) {
    return truncateString(config.url || fullUrl, 240);
  }
}

function normalizeRequestMethod(config?: AxiosRequestConfig) {
  return String(config?.method || 'GET').toUpperCase();
}

function isTimeoutError(error: unknown) {
  const axiosError = error as AxiosError;
  const code = axiosError?.code || '';
  const message = normalizeErrorMessage(error).toLowerCase();

  return (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    message.includes('timeout')
  );
}

function getRequestMeta(config?: AxiosRequestConfig) {
  return (config as InstrumentedRequestConfig | undefined)?.[
    REQUEST_LOG_META_KEY
  ];
}

function markOpenApiRequestStarted(config: InstrumentedRequestConfig) {
  if (!diagnosticsEnabled || !config[REQUEST_LOG_META_KEY]) {
    return;
  }

  openApiInFlightRequests.set(config[REQUEST_LOG_META_KEY].requestId, true);
  lastOpenApiDiagnosticsUpdatedAt = Date.now();
  notifyOpenApiDiagnosticListeners();
}

function shouldRecordOpenApiDiagnostic(record: OpenApiRequestDiagnosticRecord) {
  return record.isSlow || record.outcome !== 'success';
}

function pushOpenApiRequestDiagnosticRecord(
  record: OpenApiRequestDiagnosticRecord,
) {
  if (!diagnosticsEnabled || !shouldRecordOpenApiDiagnostic(record)) {
    return;
  }

  openApiDiagnosticRecords.unshift(record);
  if (openApiDiagnosticRecords.length > OPENAPI_DIAGNOSTIC_RECORD_LIMIT) {
    openApiDiagnosticRecords.length = OPENAPI_DIAGNOSTIC_RECORD_LIMIT;
  }
  lastOpenApiDiagnosticsUpdatedAt = record.endedAt;

  if (!shouldSuppressOpenApiDiagnosticConsole()) {
    logger.info('[openapi] request diagnostic', {
      source: record.source,
      requestId: record.requestId,
      outcome: record.outcome,
      method: record.method,
      baseURL: record.baseURL,
      path: record.path,
      url: record.url,
      params: record.params,
      durationMs: record.durationMs,
      status: record.status,
      apiCode: record.apiCode,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      slowThresholdMs: OPENAPI_SLOW_REQUEST_MS,
    });
  }

  notifyOpenApiDiagnosticListeners();
}

function getResponseOutcome(response: AxiosResponse) {
  const apiCode = extractOpenApiResponseCode(response.data);

  if (typeof response.status === 'number' && response.status !== 200) {
    return {
      apiCode,
      outcome: 'http_error' as const,
    };
  }

  if (
    (typeof apiCode === 'number' && apiCode !== 200) ||
    (typeof apiCode === 'string' && apiCode !== '200')
  ) {
    return {
      apiCode,
      outcome: 'api_error' as const,
    };
  }

  return {
    apiCode,
    outcome: 'success' as const,
  };
}

function getErrorOutcome(error: unknown, response?: AxiosResponse) {
  if (response) {
    const responseOutcome = getResponseOutcome(response);
    if (responseOutcome.outcome !== 'success') {
      return responseOutcome.outcome;
    }
  }

  if (isTimeoutError(error)) {
    return 'timeout';
  }

  const axiosError = error as AxiosError;
  if (axiosError?.request && !axiosError.response) {
    return 'network_error';
  }

  return 'error';
}

function buildOpenApiRequestDiagnosticRecord(args: {
  source: OpenApiFailureSource;
  config?: AxiosRequestConfig;
  response?: AxiosResponse;
  error?: unknown;
}): OpenApiRequestDiagnosticRecord | null {
  const { source, config, response, error } = args;
  const meta = getRequestMeta(config);

  if (meta?.finalized) {
    return null;
  }

  if (meta) {
    meta.finalized = true;
    openApiInFlightRequests.delete(meta.requestId);
  }

  const endedAt = Date.now();
  const startedAt = meta?.startedAt || endedAt;
  const durationMs = Math.max(0, endedAt - startedAt);
  const responseOutcome = response ? getResponseOutcome(response) : null;
  const isSlow = durationMs >= OPENAPI_SLOW_REQUEST_MS;
  const successOutcome =
    responseOutcome?.outcome === 'success' && isSlow ? 'slow' : 'success';
  const outcome = error
    ? getErrorOutcome(error, response)
    : responseOutcome?.outcome === 'success'
    ? successOutcome
    : responseOutcome?.outcome || successOutcome;
  const axiosError = error as AxiosError;

  return {
    id: ++nextOpenApiDiagnosticId,
    source,
    requestId: meta?.requestId || 'unknown',
    method: normalizeRequestMethod(config),
    baseURL: config?.baseURL || '',
    url: config ? buildRequestUrl(config) : '[missing-url]',
    path: buildRequestPath(config),
    params: sanitizeValue(config?.params),
    startedAt,
    endedAt,
    durationMs,
    status: response?.status,
    apiCode: responseOutcome?.apiCode,
    outcome,
    isSlow,
    errorCode: typeof axiosError?.code === 'string' ? axiosError.code : '',
    errorMessage: error ? truncateString(normalizeErrorMessage(error)) : '',
  };
}

function finalizeOpenApiRequestDiagnostic(args: {
  source: OpenApiFailureSource;
  config?: AxiosRequestConfig;
  response?: AxiosResponse;
  error?: unknown;
}) {
  const record = buildOpenApiRequestDiagnosticRecord(args);
  if (!record) {
    return;
  }

  pushOpenApiRequestDiagnosticRecord(record);
}

export function extractOpenApiResponseCode(data: unknown) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const rawCode =
    (data as { err_code?: unknown }).err_code ??
    (data as { error_code?: unknown }).error_code;

  if (rawCode === null || typeof rawCode === 'undefined') {
    return null;
  }

  if (typeof rawCode === 'number') {
    return rawCode;
  }

  if (typeof rawCode === 'string' && rawCode.trim()) {
    const numericCode = Number(rawCode);
    return Number.isNaN(numericCode) ? rawCode : numericCode;
  }

  return String(rawCode);
}

export function shouldLogOpenApiFailureResponse(response: {
  status?: number;
  data?: unknown;
}) {
  const apiCode = extractOpenApiResponseCode(response.data);

  if (typeof response.status === 'number' && response.status !== 200) {
    return true;
  }

  if (typeof apiCode === 'number') {
    return apiCode !== 200;
  }

  if (typeof apiCode === 'string') {
    return apiCode !== '200';
  }

  return false;
}

export function shouldToastOpenApiHttpErrorStatus(status?: number) {
  return typeof status === 'number' && status >= 400 && status < 600;
}

function toToastUrl(config?: AxiosRequestConfig) {
  if (!config) {
    return '[missing-url]';
  }

  const fullUrl = buildRequestUrl(config);

  try {
    const url = new URL(fullUrl);
    const pathWithSearch = `${url.pathname}${url.search}`;
    return truncateString(pathWithSearch || url.pathname || fullUrl, 160);
  } catch (_error) {
    return truncateString(fullUrl, 160);
  }
}

export function buildOpenApiHttpErrorToastMessage(args: {
  source: OpenApiFailureSource;
  config?: AxiosRequestConfig;
  response?: AxiosResponse;
}) {
  const { source, config, response } = args;
  const status =
    typeof response?.status === 'number' ? String(response.status) : 'unknown';
  const method = String(config?.method || 'GET').toUpperCase();
  const requestUrl = toToastUrl(config);

  return `[${source}] HTTP ${status} ${method} ${requestUrl}`;
}

function maybeToastOpenApiHttpError(args: {
  source: OpenApiFailureSource;
  config?: AxiosRequestConfig;
  response?: AxiosResponse;
}) {
  if (!shouldToastOpenApiHttpErrorStatus(args.response?.status)) {
    return;
  }

  openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, {
    source: args.source,
    status: args.response!.status,
    method: String(args.config?.method || 'GET').toUpperCase(),
    url: toToastUrl(args.config),
    message: buildOpenApiHttpErrorToastMessage(args),
  });
}

export function buildOpenApiFailurePayload(args: {
  source: OpenApiFailureSource;
  config?: AxiosRequestConfig;
  response?: AxiosResponse;
  error?: unknown;
}) {
  const { source, config, response, error } = args;
  const meta = (config as InstrumentedRequestConfig | undefined)?.[
    REQUEST_LOG_META_KEY
  ];

  return {
    source,
    requestId: meta?.requestId || 'unknown',
    request: config
      ? {
          method: String(config.method || 'GET').toUpperCase(),
          url: buildRequestUrl(config),
          baseURL: config.baseURL || '',
          timeout: config.timeout || 0,
          headers: sanitizeHeaders(config.headers),
          params: sanitizeValue(config.params),
          data: sanitizeValue(config.data),
        }
      : null,
    response: response
      ? {
          status: response.status,
          statusText: response.statusText || '',
          headers: sanitizeHeaders(response.headers),
          data: sanitizeValue(response.data),
          apiCode: extractOpenApiResponseCode(response.data),
        }
      : null,
    error: error
      ? {
          name: error instanceof Error ? error.name : 'Error',
          message: truncateString(normalizeErrorMessage(error)),
          ...(error instanceof Error && error.stack
            ? { stack: truncateString(error.stack, 2400) }
            : {}),
          ...(typeof (error as AxiosError).code === 'string'
            ? { code: (error as AxiosError).code }
            : {}),
        }
      : null,
  };
}

export function shouldSuppressOpenApiDiagnosticConsole() {
  const global = globalThis as OpenApiDiagnosticsGlobal;

  if (global.__RABBY_OPENAPI_DIAGNOSTIC_CONSOLE_DISABLED__) {
    return true;
  }

  return shouldSuppressPerfCaptureConsoleNoise();
}

function logOpenApiFailure(args: {
  source: OpenApiFailureSource;
  config?: AxiosRequestConfig;
  response?: AxiosResponse;
  error?: unknown;
}) {
  if (!diagnosticsEnabled) {
    return;
  }

  if (shouldSuppressOpenApiDiagnosticConsole()) {
    return;
  }

  maybeToastOpenApiHttpError(args);
  logger.warn(
    '[openapi] non-200 request detected',
    buildOpenApiFailurePayload(args),
  );
}

function wrapExistingResponseHandlers(
  request: AxiosRequestLike,
  source: OpenApiFailureSource,
) {
  request.interceptors.response.handlers?.forEach(handler => {
    if (!handler?.fulfilled) {
      return;
    }

    if (
      (handler.fulfilled as unknown as Record<symbol, unknown>)[
        RESPONSE_WRAPPED_KEY
      ]
    ) {
      return;
    }

    const originalFulfilled = handler.fulfilled;
    const wrappedFulfilled = (response: AxiosResponse) => {
      finalizeOpenApiRequestDiagnostic({
        source,
        config: response.config,
        response,
      });

      if (shouldLogOpenApiFailureResponse(response)) {
        logOpenApiFailure({
          source,
          config: response.config,
          response,
        });
      }

      return originalFulfilled(response);
    };

    (wrappedFulfilled as unknown as Record<symbol, unknown>)[
      RESPONSE_WRAPPED_KEY
    ] = true;

    handler.fulfilled = wrappedFulfilled;
  });
}

function attachRequestDiagnosticsToRequest(
  request: AxiosRequestLike,
  source: OpenApiFailureSource,
) {
  if (request[REQUEST_INSTRUMENTED_KEY]) {
    return;
  }

  request[REQUEST_INSTRUMENTED_KEY] = true;

  wrapExistingResponseHandlers(request, source);

  request.interceptors.request.use(config => {
    const nextConfig = config as InstrumentedRequestConfig;
    nextConfig[REQUEST_LOG_META_KEY] = {
      source,
      requestId: makeRequestId(source),
      startedAt: Date.now(),
    };
    markOpenApiRequestStarted(nextConfig);
    return nextConfig;
  });

  request.interceptors.response.use(undefined, error => {
    const axiosError = error as AxiosError;
    const config = axiosError.config;
    const response = axiosError.response;

    finalizeOpenApiRequestDiagnostic({
      source,
      config,
      response,
      error,
    });

    if (config && (!response || shouldLogOpenApiFailureResponse(response))) {
      logOpenApiFailure({
        source,
        config,
        response,
        error,
      });
    }

    return Promise.reject(error);
  });
}

export function instrumentOpenApiRequestDiagnostics(
  service: OpenApiService,
  source: OpenApiFailureSource,
) {
  if (!diagnosticsEnabled) {
    return;
  }

  const instrumentedService = service as OpenApiService & {
    [SERVICE_INSTRUMENTED_KEY]?: boolean;
    initSync(options?: unknown): void;
  };

  if (!instrumentedService[SERVICE_INSTRUMENTED_KEY]) {
    const originalInitSync = service.initSync.bind(service);

    instrumentedService.initSync = (options?: unknown) => {
      originalInitSync(options as never);
      attachRequestDiagnosticsToRequest(
        instrumentedService.request as AxiosRequestLike,
        source,
      );
    };

    instrumentedService[SERVICE_INSTRUMENTED_KEY] = true;
  }

  attachRequestDiagnosticsToRequest(
    service.request as AxiosRequestLike,
    source,
  );
}
