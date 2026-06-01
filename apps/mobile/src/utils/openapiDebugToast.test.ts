const mockToastError = jest.fn();
const mockGetExpSetting = jest.fn();

jest.mock('@/components2024/Toast', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/hooks/appSettings', () => ({
  storeApiExpSettingData: {
    get: (...args: unknown[]) => mockGetExpSetting(...args),
  },
}));

const loadSubject = () => {
  jest.resetModules();
  const subject =
    require('./openapiDebugToast') as typeof import('./openapiDebugToast');
  const events =
    require('./openapiDebugEvents') as typeof import('./openapiDebugEvents');
  return {
    ...subject,
    ...events,
  };
};

const detail = {
  source: 'openapi' as const,
  status: 503,
  method: 'GET',
  url: '/v1/wallet',
  message: '[openapi] HTTP 503 GET /v1/wallet',
};

describe('openapiDebugToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
    jest.clearAllMocks();
    mockGetExpSetting.mockReturnValue({
      toastOpenApiHttpErrorStatus: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  it('shows OpenAPI HTTP error toasts when the experiment setting is enabled', () => {
    const {
      OPENAPI_HTTP_ERROR_DEBUG,
      openApiDebugEvents,
      startSubscribeOpenApiHttpErrorDebugToast,
    } = loadSubject();

    startSubscribeOpenApiHttpErrorDebugToast();
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);

    expect(mockToastError).toHaveBeenCalledWith(detail.message);
  });

  it('does not subscribe twice when started multiple times', () => {
    const {
      OPENAPI_HTTP_ERROR_DEBUG,
      openApiDebugEvents,
      startSubscribeOpenApiHttpErrorDebugToast,
    } = loadSubject();

    startSubscribeOpenApiHttpErrorDebugToast();
    startSubscribeOpenApiHttpErrorDebugToast();
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);

    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('dedupes identical messages for the configured toast window', () => {
    const {
      OPENAPI_HTTP_ERROR_DEBUG,
      openApiDebugEvents,
      startSubscribeOpenApiHttpErrorDebugToast,
    } = loadSubject();

    startSubscribeOpenApiHttpErrorDebugToast();
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);
    jest.advanceTimersByTime(2_999);
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);
    jest.advanceTimersByTime(1);
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);

    expect(mockToastError).toHaveBeenCalledTimes(2);
  });

  it('does not dedupe different error messages', () => {
    const {
      OPENAPI_HTTP_ERROR_DEBUG,
      openApiDebugEvents,
      startSubscribeOpenApiHttpErrorDebugToast,
    } = loadSubject();

    startSubscribeOpenApiHttpErrorDebugToast();
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, {
      ...detail,
      message: '[openapi] HTTP 504 GET /v1/wallet',
      status: 504,
    });

    expect(mockToastError).toHaveBeenCalledTimes(2);
  });

  it('respects the experiment setting on every emitted event', () => {
    const {
      OPENAPI_HTTP_ERROR_DEBUG,
      openApiDebugEvents,
      startSubscribeOpenApiHttpErrorDebugToast,
    } = loadSubject();

    startSubscribeOpenApiHttpErrorDebugToast();
    mockGetExpSetting.mockReturnValue({
      toastOpenApiHttpErrorStatus: false,
    });
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);

    expect(mockToastError).not.toHaveBeenCalled();
  });
});
