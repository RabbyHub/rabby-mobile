function mockStartupScheduler() {
  jest.doMock('@/core/utils/startupScheduler', () => ({
    runOnDemandStartupTask: (task: () => unknown) => Promise.resolve(task()),
  }));
}

describe('core/serviceApi/session', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('keeps getOrCreateSessionSync strict because it must return a session', () => {
    mockStartupScheduler();

    const { getOrCreateSessionSync } =
      require('./session') as typeof import('./session');

    expect(() =>
      getOrCreateSessionSync({ origin: 'https://app.example' } as any),
    ).toThrow('sessionService is not ready');
  });

  it('does not load sessionService for sync broadcasts when it is not ready', () => {
    mockStartupScheduler();

    const { broadcastSessionEventSync } =
      require('./session') as typeof import('./session');
    const { registerCoreServiceLoader } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const loader = jest.fn();
    registerCoreServiceLoader('sessionService', loader);

    expect(() =>
      broadcastSessionEventSync(
        'accountsChanged' as any,
        ['0xabc'],
        'https://app.example',
      ),
    ).not.toThrow();

    expect(loader).not.toHaveBeenCalled();
  });

  it('broadcasts synchronously when sessionService is ready', () => {
    mockStartupScheduler();

    const broadcastEvent = jest.fn();
    const { registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');
    const { broadcastSessionEventSync } =
      require('./session') as typeof import('./session');

    registerService('sessionService', {
      broadcastEvent,
      deleteSession: jest.fn(),
      getOrCreateSession: jest.fn(),
    } as any);

    broadcastSessionEventSync(
      'accountsChanged' as any,
      ['0xabc'],
      'https://app.example',
    );

    expect(broadcastEvent).toHaveBeenCalledWith(
      'accountsChanged',
      ['0xabc'],
      'https://app.example',
    );
  });
});
