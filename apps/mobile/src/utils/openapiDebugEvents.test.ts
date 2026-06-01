import {
  OPENAPI_HTTP_ERROR_DEBUG,
  openApiDebugEvents,
} from './openapiDebugEvents';

describe('openapiDebugEvents', () => {
  afterEach(() => {
    openApiDebugEvents.removeAllListeners();
  });

  it('delivers HTTP debug events to subscribed listeners and removes them', () => {
    const listener = jest.fn();
    const detail = {
      source: 'openapi' as const,
      status: 500,
      method: 'GET',
      url: 'https://api.example.test/wallet',
      message: 'server error',
    };

    const subscription = openApiDebugEvents.subscribe(
      OPENAPI_HTTP_ERROR_DEBUG,
      listener,
    );

    expect(openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail)).toBe(
      true,
    );
    expect(listener).toHaveBeenCalledWith(detail);

    subscription.remove();
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, {
      ...detail,
      status: 404,
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports standard on/off listener management', () => {
    const listener = jest.fn();
    const detail = {
      source: 'notificationOpenapi' as const,
      status: 429,
      method: 'POST',
      url: 'https://api.example.test/notification',
      message: 'rate limited',
    };

    openApiDebugEvents.on(OPENAPI_HTTP_ERROR_DEBUG, listener);
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);
    openApiDebugEvents.off(OPENAPI_HTTP_ERROR_DEBUG, listener);
    openApiDebugEvents.emit(OPENAPI_HTTP_ERROR_DEBUG, detail);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(detail);
  });
});
