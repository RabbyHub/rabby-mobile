import { MaskedLogValue } from '@rabby-wallet/rabby-logger';

jest.mock('./logger', () => {
  const {
    MaskedLogValue: NextMaskedLogValue,
  } = require('@rabby-wallet/rabby-logger');

  return {
    logger: {
      mask: jest.fn((value: unknown) => new NextMaskedLogValue(value)),
      warn: jest.fn(),
    },
  };
});

import {
  buildOpenApiHttpErrorToastMessage,
  buildOpenApiFailurePayload,
  extractOpenApiResponseCode,
  instrumentOpenApiFailureLogging,
  shouldLogOpenApiFailureResponse,
  shouldToastOpenApiHttpErrorStatus,
} from './openapiFailureLogging';
import {
  OPENAPI_HTTP_ERROR_DEBUG,
  openApiDebugEvents,
} from './openapiDebugEvents';
import { logger } from './logger';

const createRequestLike = () => {
  const requestUse = jest.fn();
  const responseUse = jest.fn((fulfilled, rejected) => {
    request.interceptors.response.handlers.push({ fulfilled, rejected });
    return request.interceptors.response.handlers.length - 1;
  });
  const originalFulfilled = jest.fn(response => ({
    ...response,
    handled: true,
  }));
  const request = {
    interceptors: {
      request: {
        use: requestUse,
      },
      response: {
        handlers: [
          {
            fulfilled: originalFulfilled,
          },
        ],
        use: responseUse,
      },
    },
  };

  return {
    request,
    requestUse,
    responseUse,
    originalFulfilled,
  };
};

describe('openapi failure logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openApiDebugEvents.removeAllListeners();
  });

  it('detects http and api-level non-200 responses', () => {
    expect(
      shouldLogOpenApiFailureResponse({
        status: 500,
        data: { err_code: 200 },
      }),
    ).toBe(true);

    expect(
      shouldLogOpenApiFailureResponse({
        status: 200,
        data: { err_code: 401 },
      }),
    ).toBe(true);

    expect(
      shouldLogOpenApiFailureResponse({
        status: 200,
        data: { err_code: 200 },
      }),
    ).toBe(false);
  });

  it('only toasts for http 4xx and 5xx statuses', () => {
    expect(shouldToastOpenApiHttpErrorStatus(400)).toBe(true);
    expect(shouldToastOpenApiHttpErrorStatus(503)).toBe(true);
    expect(shouldToastOpenApiHttpErrorStatus(200)).toBe(false);
    expect(shouldToastOpenApiHttpErrorStatus(302)).toBe(false);
    expect(shouldToastOpenApiHttpErrorStatus(undefined)).toBe(false);
  });

  it('extracts normalized api codes from different response shapes', () => {
    expect(extractOpenApiResponseCode({ err_code: 403 })).toBe(403);
    expect(extractOpenApiResponseCode({ error_code: '429' })).toBe(429);
    expect(extractOpenApiResponseCode({})).toBeNull();
  });

  it('masks sensitive headers when building the failure payload', () => {
    const payload = buildOpenApiFailurePayload({
      source: 'openapi',
      config: {
        method: 'post',
        baseURL: 'https://app-api.rabby.io',
        url: '/v1/demo',
        headers: {
          Authorization: 'Bearer secret',
          'X-API-Key': 'api-key-value',
          'X-Trace-Id': 'trace-123',
        },
        data: {
          token: 'should-mask',
          visible: 'hello',
        },
      },
      response: {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'set-cookie': 'token=secret',
        },
        data: {
          err_code: 503,
          err_msg: 'upstream failed',
        },
        config: {} as never,
      } as never,
    });

    expect(payload.request?.url).toBe('https://app-api.rabby.io/v1/demo');
    expect(payload.request?.headers.Authorization).toBeInstanceOf(
      MaskedLogValue,
    );
    expect(payload.request?.headers['X-API-Key']).toBeInstanceOf(
      MaskedLogValue,
    );
    expect(payload.request?.headers['X-Trace-Id']).toBe('trace-123');
    expect(payload.request?.data).toEqual({
      token: expect.any(MaskedLogValue),
      visible: 'hello',
    });
    expect(payload.response?.headers['set-cookie']).toBeInstanceOf(
      MaskedLogValue,
    );
    expect(payload.response?.apiCode).toBe(503);
  });

  it('builds a concise toast message for http error responses', () => {
    expect(
      buildOpenApiHttpErrorToastMessage({
        source: 'notificationOpenapi',
        config: {
          method: 'post',
          baseURL: 'https://alpha.rabby.io',
          url: '/v1/notification/device/heartbeat?foo=bar',
        },
        response: {
          status: 503,
        } as never,
      }),
    ).toBe(
      '[notificationOpenapi] HTTP 503 POST /v1/notification/device/heartbeat?foo=bar',
    );
  });

  it('instruments requests with source/request id metadata and wraps failed fulfilled responses', () => {
    const listener = jest.fn();
    const { request, requestUse, originalFulfilled } = createRequestLike();
    const service = {
      initSync: jest.fn(),
      request,
    } as never;

    openApiDebugEvents.on(OPENAPI_HTTP_ERROR_DEBUG, listener);
    instrumentOpenApiFailureLogging(service, 'openapi');

    const config = requestUse.mock.calls[0][0]({
      method: 'get',
      baseURL: 'https://app-api.rabby.io',
      url: '/v1/wallet',
    });

    expect(config.__rabbyOpenApiFailureMeta).toMatchObject({
      source: 'openapi',
      requestId: expect.stringMatching(/^openapi-/),
    });

    const response = {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {},
      data: { err_code: 503 },
      config,
    } as never;

    expect(
      request.interceptors.response.handlers[0].fulfilled(response),
    ).toMatchObject({
      handled: true,
    });

    expect(originalFulfilled).toHaveBeenCalledWith(response);
    expect(logger.warn).toHaveBeenCalledWith(
      '[openapi] non-200 request detected',
      expect.objectContaining({
        requestId: config.__rabbyOpenApiFailureMeta.requestId,
        source: 'openapi',
      }),
    );
    expect(listener).toHaveBeenCalledWith({
      source: 'openapi',
      status: 503,
      method: 'GET',
      url: '/v1/wallet',
      message: '[openapi] HTTP 503 GET /v1/wallet',
    });
  });

  it('logs rejected request failures and keeps instrumentation idempotent', async () => {
    const { request, requestUse, responseUse } = createRequestLike();
    const originalInitSync = jest.fn();
    const service = {
      initSync: originalInitSync,
      request,
    } as any;

    instrumentOpenApiFailureLogging(service, 'testOpenapi');
    instrumentOpenApiFailureLogging(service, 'testOpenapi');

    expect(requestUse).toHaveBeenCalledTimes(1);
    expect(responseUse).toHaveBeenCalledTimes(1);

    service.initSync({ from: 'bootstrap' });
    expect(originalInitSync).toHaveBeenCalledWith({ from: 'bootstrap' });
    expect(requestUse).toHaveBeenCalledTimes(1);

    const rejected = request.interceptors.response.handlers.at(-1)?.rejected;
    const error = Object.assign(new Error('network down'), {
      code: 'ECONNABORTED',
      config: {
        method: 'post',
        baseURL: 'https://test-api.rabby.io',
        url: '/v1/tx',
      },
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data: { error_code: '500' },
      },
    });

    await expect(rejected?.(error)).rejects.toBe(error);

    expect(logger.warn).toHaveBeenCalledWith(
      '[openapi] non-200 request detected',
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'ECONNABORTED',
          message: 'network down',
        }),
        response: expect.objectContaining({
          apiCode: 500,
          status: 500,
        }),
        source: 'testOpenapi',
      }),
    );
  });
});
