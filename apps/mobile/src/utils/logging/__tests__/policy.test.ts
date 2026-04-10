import {
  APP_FILE_LOGGING_ONLINE_SWITCH,
  getDefaultLocalAppFileLoggingEnabled,
  resolveAppFileLoggingEnabled,
  resolveConsoleCaptureEnabled,
} from '../policy';

describe('logging policy', () => {
  it('uses development-on and regression-off as the local defaults', () => {
    expect(getDefaultLocalAppFileLoggingEnabled('development')).toBe(true);
    expect(getDefaultLocalAppFileLoggingEnabled('regression')).toBe(false);
    expect(getDefaultLocalAppFileLoggingEnabled('production')).toBe(false);
  });

  it('uses the local switch in development', () => {
    expect(
      resolveAppFileLoggingEnabled({
        runtimeEnv: 'development',
        localEnabled: true,
        prodOnlineEnabled: false,
      }),
    ).toBe(true);

    expect(
      resolveAppFileLoggingEnabled({
        runtimeEnv: 'development',
        localEnabled: false,
        prodOnlineEnabled: true,
      }),
    ).toBe(false);
  });

  it('uses the local switch in regression', () => {
    expect(
      resolveAppFileLoggingEnabled({
        runtimeEnv: 'regression',
        localEnabled: true,
        prodOnlineEnabled: false,
      }),
    ).toBe(true);

    expect(
      resolveAppFileLoggingEnabled({
        runtimeEnv: 'regression',
        localEnabled: false,
        prodOnlineEnabled: true,
      }),
    ).toBe(false);
  });

  it('uses the online config switch in production', () => {
    expect(
      resolveAppFileLoggingEnabled({
        runtimeEnv: 'production',
        localEnabled: true,
        prodOnlineEnabled: false,
      }),
    ).toBe(false);

    expect(
      resolveAppFileLoggingEnabled({
        runtimeEnv: 'production',
        localEnabled: false,
        prodOnlineEnabled: true,
      }),
    ).toBe(true);
  });

  it('uses the same policy to decide whether console capture is active', () => {
    expect(
      resolveConsoleCaptureEnabled({
        runtimeEnv: 'development',
        localEnabled: true,
        prodOnlineEnabled: false,
      }),
    ).toBe(true);

    expect(
      resolveConsoleCaptureEnabled({
        runtimeEnv: 'regression',
        localEnabled: false,
        prodOnlineEnabled: true,
      }),
    ).toBe(false);
  });

  it('keeps the online config switch name stable', () => {
    expect(APP_FILE_LOGGING_ONLINE_SWITCH).toBe(
      '20260410.enable_app_file_logging',
    );
  });
});
