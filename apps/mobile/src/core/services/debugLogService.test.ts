function loadDebugLogService() {
  jest.resetModules();

  const service = require('./debugLogService')
    .default as typeof import('./debugLogService').default;
  service.clearLogs();

  return service;
}

describe('core/services/debugLogService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    loadDebugLogService().clearLogs();
  });

  it('adds newest logs first and notifies active subscribers only', () => {
    jest.spyOn(Date, 'now').mockReturnValue(123);
    const service = loadDebugLogService();
    const listener = jest.fn();
    const unsubscribe = service.subscribe(listener);

    service.info('first', {
      value: 1,
    });
    service.warn('second');
    unsubscribe();
    service.error('third');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(service.getLogs()).toEqual([
      {
        data: undefined,
        level: 'error',
        message: 'third',
        timestamp: 123,
      },
      {
        data: undefined,
        level: 'warn',
        message: 'second',
        timestamp: 123,
      },
      {
        data: {
          value: 1,
        },
        level: 'info',
        message: 'first',
        timestamp: 123,
      },
    ]);
  });

  it('keeps only the latest 500 log entries and clears logs with notification', () => {
    const service = loadDebugLogService();
    const listener = jest.fn();
    service.subscribe(listener);

    for (let index = 0; index < 505; index += 1) {
      jest.spyOn(Date, 'now').mockReturnValue(index);
      service.debug(`log-${index}`);
      jest.restoreAllMocks();
    }

    const logs = service.getLogs();
    expect(service.getLogsCount()).toBe(500);
    expect(logs[0].message).toBe('log-504');
    expect(logs[499].message).toBe('log-5');

    service.clearLogs();

    expect(service.getLogs()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(506);
  });
});
