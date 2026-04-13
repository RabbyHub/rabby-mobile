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
  shouldLogOpenApiFailureResponse,
  shouldToastOpenApiHttpErrorStatus,
} from './openapiFailureLogging';

describe('openapi failure logging', () => {
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
});
