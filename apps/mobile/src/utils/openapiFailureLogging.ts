import type { OpenApiService } from '@rabby-wallet/rabby-api';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from './logger';
import {
  openApiDebugEvents,
  OPENAPI_HTTP_ERROR_DEBUG,
} from './openapiDebugEvents';

const REQUEST_LOG_META_KEY = '__rabbyOpenApiFailureMeta';
const REQUEST_INSTRUMENTED_KEY = Symbol('rabbyOpenApiFailureLogging/request');
const SERVICE_INSTRUMENTED_KEY = Symbol('rabbyOpenApiFailureLogging/service');

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

type InstrumentedRequestConfig = AxiosRequestConfig & {
  [REQUEST_LOG_META_KEY]?: {
    source: OpenApiFailureSource;
    requestId: string;
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
    return apiCode !== 0 && apiCode !== 200;
  }

  if (typeof apiCode === 'string') {
    return apiCode !== '0' && apiCode !== '200';
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

function logOpenApiFailure(args: {
  source: OpenApiFailureSource;
  config?: AxiosRequestConfig;
  response?: AxiosResponse;
  error?: unknown;
}) {
  maybeToastOpenApiHttpError(args);
  logger.warn(
    '[openapi] non-200 request detected',
    buildOpenApiFailurePayload(args),
  );
}

function attachFailureLoggingToRequest(
  request: AxiosRequestLike,
  source: OpenApiFailureSource,
) {
  if (request[REQUEST_INSTRUMENTED_KEY]) {
    return;
  }

  request[REQUEST_INSTRUMENTED_KEY] = true;

  request.interceptors.request.use(config => {
    const nextConfig = config as InstrumentedRequestConfig;
    nextConfig[REQUEST_LOG_META_KEY] = {
      source,
      requestId: makeRequestId(source),
    };
    return nextConfig;
  });

  request.interceptors.response.use(
    response => {
      if (shouldLogOpenApiFailureResponse(response)) {
        logOpenApiFailure({
          source,
          config: response.config,
          response,
        });
      }

      return response;
    },
    error => {
      const axiosError = error as AxiosError;
      const config = axiosError.config;
      const response = axiosError.response;

      if (config && (!response || shouldLogOpenApiFailureResponse(response))) {
        logOpenApiFailure({
          source,
          config,
          response,
          error,
        });
      }

      return Promise.reject(error);
    },
  );
}

export function instrumentOpenApiFailureLogging(
  service: OpenApiService,
  source: OpenApiFailureSource,
) {
  const instrumentedService = service as OpenApiService & {
    [SERVICE_INSTRUMENTED_KEY]?: boolean;
    initSync(options?: unknown): void;
  };

  if (!instrumentedService[SERVICE_INSTRUMENTED_KEY]) {
    const originalInitSync = service.initSync.bind(service);

    instrumentedService.initSync = (options?: unknown) => {
      originalInitSync(options as never);
      attachFailureLoggingToRequest(
        instrumentedService.request as AxiosRequestLike,
        source,
      );
    };

    instrumentedService[SERVICE_INSTRUMENTED_KEY] = true;
  }

  attachFailureLoggingToRequest(service.request as AxiosRequestLike, source);
}
