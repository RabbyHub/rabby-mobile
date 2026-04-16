function loadLoggerModule() {
  jest.resetModules();

  jest.doMock('react-native-fs', () => ({
    DocumentDirectoryPath: '/documents',
  }));

  jest.doMock('./logging/settings', () => ({
    getEffectiveConsoleCaptureEnabled: jest.fn(() => true),
    getEffectiveFileLoggingEnabled: jest.fn(() => true),
  }));

  jest.doMock('@/core/services/debugLogService', () => ({
    __esModule: true,
    default: {
      addLog: jest.fn(),
    },
  }));

  jest.doMock('@rabby-wallet/rabby-logger', () => {
    return {
      AppLogger: class MockAppLogger {
        debug = jest.fn();
      },
      RollingZipLogWriter: class MockRollingZipLogWriter {},
    };
  });

  return require('./logger') as typeof import('./logger');
}

describe('devLog', () => {
  const originalDev = (globalThis as any).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).__DEV__ = originalDev;
  });

  afterAll(() => {
    (globalThis as any).__DEV__ = originalDev;
  });

  it('logs bare keys when no extra info is provided', () => {
    (globalThis as any).__DEV__ = true;
    const { devLog, logger } = loadLoggerModule();

    devLog('simple');

    expect(logger.debug).toHaveBeenCalledWith('simple');
  });

  it('prefixes the key when extra info is provided', () => {
    (globalThis as any).__DEV__ = true;
    const { devLog, logger } = loadLoggerModule();

    devLog('scope', 'a', 1);

    expect(logger.debug).toHaveBeenCalledWith('[scope]', 'a', 1);
  });

  it('does nothing outside dev mode', () => {
    (globalThis as any).__DEV__ = false;
    const { devLog, logger } = loadLoggerModule();

    devLog('scope', 'a', 1);

    expect(logger.debug).not.toHaveBeenCalled();
  });
});
