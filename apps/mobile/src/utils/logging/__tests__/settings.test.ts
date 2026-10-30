function loadSettings({
  runtimeEnv,
  diagnosticExportEnabled,
  onlineEnabled = false,
}: {
  runtimeEnv: string;
  diagnosticExportEnabled: boolean;
  onlineEnabled?: boolean;
}) {
  jest.resetModules();
  const setState = jest.fn();
  jest.doMock('@/constant/env', () => ({
    APP_RUNTIME_ENV: runtimeEnv,
    IS_LOCAL_STORAGE_EXPORT_ENABLED: diagnosticExportEnabled,
  }));
  jest.doMock('@/constant', () => ({
    isNonPublicProductionEnv: runtimeEnv !== 'production',
  }));
  jest.doMock('@/core/config/online', () => ({
    getOnlineConfig: () => ({
      switches: { '20260410.enable_app_file_logging': onlineEnabled },
    }),
  }));
  jest.doMock('@/core/storage/mmkv', () => ({
    zustandByMMKV: () => ({
      getState: () => ({
        developmentFileLoggingEnabled: false,
        regressionFileLoggingEnabled: false,
      }),
      setState,
    }),
  }));
  const settings = require('../settings') as typeof import('../settings');
  return { settings, setState };
}

describe('app logging build switch wiring', () => {
  afterEach(() => jest.resetModules());

  it.each(['development', 'regression', 'production'])(
    'keeps diagnostics logging on despite disabled persisted and online switches in %s',
    runtimeEnv => {
      const { settings, setState } = loadSettings({
        runtimeEnv,
        diagnosticExportEnabled: true,
      });
      expect(settings.getEffectiveFileLoggingEnabled()).toBe(true);
      expect(settings.getEffectiveConsoleCaptureEnabled()).toBe(true);
      expect(settings.setLocalFileLoggingEnabled(false)).toBe(true);
      expect(setState).not.toHaveBeenCalled();
    },
  );

  it.each(['development', 'regression', 'production'])(
    'preserves the existing disabled logging policy when diagnostics are off in %s',
    runtimeEnv => {
      const { settings } = loadSettings({
        runtimeEnv,
        diagnosticExportEnabled: false,
      });
      expect(settings.getEffectiveFileLoggingEnabled()).toBe(false);
      expect(settings.getEffectiveConsoleCaptureEnabled()).toBe(false);
    },
  );

  it('still respects the production online logging policy with diagnostic exports off', () => {
    const { settings } = loadSettings({
      runtimeEnv: 'production',
      diagnosticExportEnabled: false,
      onlineEnabled: true,
    });
    expect(settings.getEffectiveFileLoggingEnabled()).toBe(true);
    expect(settings.getEffectiveConsoleCaptureEnabled()).toBe(true);
  });
});
